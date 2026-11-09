/**
 * Keyboard handling (src/components/keyboard.tsx): the avoider pads by exactly
 * what the keyboard covers, only on the active screen, and the focused field
 * is scrolled above the keyboard — in screens and in bottom sheets.
 */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { DeviceEventEmitter, Text, TextInput, View } from 'react-native';
import { KeyboardAvoider, KeyboardScope, useKeyboardScroll } from '../src/components/keyboard';
import { Input, Sheet } from '../src/components/ui';
import { createActiveStore, ScreenActiveContext } from '../src/hooks';

// Every View reports this window frame: y 100, height 700 → bottom 800.
// (Jest's View mock is a class with jest.fn() native methods.)
const nodeMock = () => null;
beforeEach(() => {
  jest
    .spyOn(View.prototype as any, 'measureInWindow')
    .mockImplementation(function (cb: any) {
      cb(0, 100, 400, 700);
    });
});

const show = (screenY: number, height: number) =>
  act(() => {
    DeviceEventEmitter.emit('keyboardWillShow', { endCoordinates: { screenX: 0, screenY, width: 400, height }, duration: 0 });
  });
const hide = () =>
  act(() => {
    DeviceEventEmitter.emit('keyboardWillHide', { endCoordinates: { screenX: 0, screenY: 900, width: 400, height: 0 }, duration: 0 });
  });

const padOf = (root: ReactTestRenderer.ReactTestRenderer, testID: string) => {
  const view = root.root.findByProps({ testID }).parent!;
  const flat = Object.assign({}, ...([] as any[]).concat(view.props.style).flat(Infinity).filter(Boolean));
  return flat.paddingBottom ?? 0;
};

function Probe() {
  return (
    <KeyboardAvoider>
      <View testID="probe" />
    </KeyboardAvoider>
  );
}

describe('KeyboardAvoider', () => {
  it('pads its bottom by the part the keyboard covers, and resets when it hides', () => {
    let root!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      root = ReactTestRenderer.create(<Probe />, { createNodeMock: nodeMock });
    });
    expect(padOf(root, 'probe')).toBe(0);
    show(500, 300); // keyboard top 500, view bottom 800 → 300 covered
    expect(padOf(root, 'probe')).toBe(300);
    hide();
    expect(padOf(root, 'probe')).toBe(0);
    act(() => root.unmount());
  });

  it('adds nothing when the OS already resized the window above the keyboard', () => {
    let root!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      root = ReactTestRenderer.create(<Probe />, { createNodeMock: nodeMock });
    });
    show(820, 300); // keyboard starts below the view
    expect(padOf(root, 'probe')).toBe(0);
    act(() => root.unmount());
  });

  it('does nothing on a screen covered by another one', () => {
    const store = createActiveStore(false);
    let root!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      root = ReactTestRenderer.create(
        <ScreenActiveContext.Provider value={store}>
          <Probe />
        </ScreenActiveContext.Provider>,
        { createNodeMock: nodeMock },
      );
    });
    show(500, 300);
    expect(padOf(root, 'probe')).toBe(0);
    act(() => store.set(true));
    expect(padOf(root, 'probe')).toBe(300);
    hide();
    act(() => root.unmount());
  });

  it('lifts a bottom sheet (Modal) above the keyboard', () => {
    let root!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      root = ReactTestRenderer.create(
        <Sheet visible title="Form" onClose={() => {}}>
          <Input testID="sheet-input" label="Name" value="" onChangeText={() => {}} />
        </Sheet>,
        { createNodeMock: nodeMock },
      );
    });
    show(500, 300);
    // The sheet's backdrop is the avoider: header + form rise together.
    const backdrop = root.root.findAll(n => n.type === View && [].concat(n.props.style).flat(Infinity).some((s: any) => s && s.paddingBottom === 300));
    expect(backdrop.length).toBeGreaterThan(0);
    hide();
    act(() => root.unmount());
  });
});

describe('useKeyboardScroll', () => {
  const scrollTo = jest.fn();
  let focused: unknown = null;
  let api!: ReturnType<typeof useKeyboardScroll>;

  function Harness({ children }: { children?: React.ReactNode }) {
    api = useKeyboardScroll();
    // A fake scroll view: visible window 100..500 once the avoider has padded it.
    api.ref.current = { scrollTo, measureInWindow: (cb: any) => cb(0, 100, 400, 400) } as any;
    return <KeyboardScope value={api.scope}>{children ?? <Text>form</Text>}</KeyboardScope>;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    scrollTo.mockClear();
    jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockImplementation(() => focused as any);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('scrolls the focused field (bottom of the form) above the keyboard', () => {
    // Field at y 700..740, keyboard top 500 → must move up to end at 500 − 24.
    focused = { measureInWindow: (cb: any) => cb(0, 700, 300, 40) };
    let root!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      root = ReactTestRenderer.create(<Harness />);
    });
    act(() => api.scope.onInputFocus());
    show(500, 300);
    act(() => {
      jest.runAllTimers();
    });
    expect(scrollTo).toHaveBeenCalledWith({ y: 264, animated: true });
    hide();
    act(() => root.unmount());
  });

  it('leaves a field that is already visible (top of the form) alone', () => {
    focused = { measureInWindow: (cb: any) => cb(0, 150, 300, 40) };
    let root!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      root = ReactTestRenderer.create(<Harness />);
    });
    act(() => api.scope.onInputFocus());
    show(500, 300);
    act(() => {
      jest.runAllTimers();
    });
    expect(scrollTo).not.toHaveBeenCalled();
    hide();
    act(() => root.unmount());
  });

  it('re-checks when focus moves to another field while the keyboard is open', () => {
    focused = { measureInWindow: (cb: any) => cb(0, 150, 300, 40) };
    let root!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      root = ReactTestRenderer.create(<Harness />);
    });
    act(() => api.scope.onInputFocus());
    show(500, 300);
    act(() => {
      jest.runAllTimers();
    });
    focused = { measureInWindow: (cb: any) => cb(0, 520, 300, 40) }; // middle field, behind the keyboard
    act(() => api.scope.onInputFocus());
    act(() => {
      jest.runAllTimers();
    });
    expect(scrollTo).toHaveBeenCalledWith({ y: 84, animated: true });
    hide();
    act(() => root.unmount());
  });

  it('ignores a field that belongs to another container (e.g. a sheet over this screen)', () => {
    focused = { measureInWindow: (cb: any) => cb(0, 700, 300, 40) };
    let root!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      root = ReactTestRenderer.create(<Harness />);
    });
    // No onInputFocus from this scope.
    show(500, 300);
    act(() => {
      jest.runAllTimers();
    });
    expect(scrollTo).not.toHaveBeenCalled();
    hide();
    act(() => root.unmount());
  });

  it('ui.tsx Input reports its focus to the nearest scope', () => {
    focused = { measureInWindow: (cb: any) => cb(0, 700, 300, 40) };
    const onFocus = jest.fn();
    let root!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      root = ReactTestRenderer.create(
        <Harness>
          <Input testID="field" value="" onChangeText={() => {}} onFocus={onFocus} />
        </Harness>,
      );
    });
    act(() => {
      root.root.findByType(TextInput).props.onFocus({ nativeEvent: {} });
    });
    expect(onFocus).toHaveBeenCalled(); // the screen's own onFocus still runs
    show(500, 300);
    act(() => {
      jest.runAllTimers();
    });
    expect(scrollTo).toHaveBeenCalledWith({ y: 264, animated: true });
    hide();
    act(() => root.unmount());
  });
});
