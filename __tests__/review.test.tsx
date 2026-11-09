/**
 * Screens changed by the Oct 2026 review: the sign-in picture challenge
 * (CAPTCHA after repeated failures) and subject-wise exam marks for parents.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Image, Text, TextInput } from 'react-native';

const fixtures: Record<string, unknown> = {};
const mockLogin = jest.fn();
const mockGetCaptcha = jest.fn();

jest.mock('../src/api', () => {
  const actual = jest.requireActual('../src/api');
  return {
    ...actual,
    api: jest.fn(async (path: string) => fixtures[path] ?? {}),
    login: (...args: unknown[]) => mockLogin(...args),
    getCaptcha: () => mockGetCaptcha(),
    getLastOrgCode: jest.fn(async () => 'DEFAULT'),
    lookupSchool: jest.fn(async (code: string) => ({ code, name: 'Default School' })),
  };
});

import { ApiError } from '../src/http';
import Login from '../src/screens/Login';
import Exams from '../src/screens/Exams';

const texts = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map(n => {
      const c = n.props.children;
      return Array.isArray(c) ? c.join('') : String(c ?? '');
    })
    .join(' | ');

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

async function render(el: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(el);
  });
  await ReactTestRenderer.act(async () => {});
  mounted.push(tree);
  return tree;
}

// unmount: stops the school-code lookup's debounce timer
afterEach(async () => {
  await ReactTestRenderer.act(async () => {
    mounted.splice(0).forEach(t => t.unmount());
  });
});

const input = (tree: ReactTestRenderer.ReactTestRenderer, placeholder: string | RegExp) =>
  tree.root.findAll(
    n => n.type === TextInput && (typeof placeholder === 'string' ? n.props.placeholder === placeholder : placeholder.test(n.props.placeholder ?? '')),
  )[0];

async function type(node: ReactTestRenderer.ReactTestInstance, value: string) {
  await ReactTestRenderer.act(async () => node.props.onChangeText(value));
}

async function press(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  const btn = tree.root.findAll(n => n.props.label === label && typeof n.props.onPress === 'function')[0];
  await ReactTestRenderer.act(async () => {
    await btn.props.onPress();
  });
}

beforeEach(() => {
  mockLogin.mockReset();
  mockGetCaptcha.mockReset();
  for (const k of Object.keys(fixtures)) delete fixtures[k];
});

test('sign-in shows the picture after the server asks, and sends the answer with the next try', async () => {
  mockLogin.mockRejectedValueOnce(
    new ApiError('Type the characters in the picture to continue.', { status: 428, code: 'captcha_required' }),
  );
  mockGetCaptcha.mockResolvedValue({ captcha_id: 'c-1', image: 'data:image/png;base64,AAAA', expires_in: 300, length: 5 });
  const tree = await render(<Login onForgotPassword={jest.fn()} />);
  expect(tree.root.findAll(n => n.props.testID === 'login-captcha')).toHaveLength(0);

  await type(input(tree, 'username'), 'admin');
  await type(input(tree, '••••••••'), 'admin123');
  await press(tree, 'Sign in');
  expect(mockLogin).toHaveBeenLastCalledWith('admin', 'admin123', 'DEFAULT', null);
  expect(tree.root.findAll(n => n.props.testID === 'login-captcha').length).toBeGreaterThan(0);
  expect(tree.root.findAllByType(Image).some(i => i.props.source?.uri === 'data:image/png;base64,AAAA')).toBe(true);
  expect(texts(tree)).toContain('Type the characters in the picture to continue.');

  // no answer yet → asks for it, no request
  await press(tree, 'Sign in');
  expect(mockLogin).toHaveBeenCalledTimes(1);

  mockLogin.mockResolvedValueOnce({ user_id: 1, user_type: 'admin', full_name: 'Admin' });
  await type(input(tree, '5 characters'), ' abcde ');
  await press(tree, 'Sign in');
  expect(mockLogin).toHaveBeenLastCalledWith('admin', 'admin123', 'DEFAULT', { id: 'c-1', answer: 'abcde' });
});

test('a wrong picture answer gets a new picture; a wrong password after it does too', async () => {
  mockGetCaptcha
    .mockResolvedValueOnce({ captcha_id: 'c-1', image: 'data:image/png;base64,AAAA', expires_in: 300, length: 5 })
    .mockResolvedValueOnce({ captcha_id: 'c-2', image: 'data:image/png;base64,BBBB', expires_in: 300, length: 5 })
    .mockResolvedValueOnce({ captcha_id: 'c-3', image: 'data:image/png;base64,CCCC', expires_in: 300, length: 5 });
  mockLogin
    .mockRejectedValueOnce(new ApiError('x', { status: 428, code: 'captcha_required' }))
    .mockRejectedValueOnce(new ApiError("Those characters didn't match.", { status: 428, code: 'captcha_invalid' }))
    .mockRejectedValueOnce(new ApiError('Wrong username or password', { status: 401 }));
  const tree = await render(<Login onForgotPassword={jest.fn()} />);
  await type(input(tree, 'username'), 'admin');
  await type(input(tree, '••••••••'), 'nope');
  await press(tree, 'Sign in');
  await type(input(tree, '5 characters'), 'zzzzz');
  await press(tree, 'Sign in');
  expect(texts(tree)).toContain("Those characters didn't match. Type the characters in the new picture.");
  expect(tree.root.findAllByType(Image).some(i => i.props.source?.uri === 'data:image/png;base64,BBBB')).toBe(true);
  await type(input(tree, '5 characters'), 'abcde');
  await press(tree, 'Sign in');
  expect(mockLogin).toHaveBeenLastCalledWith('admin', 'nope', 'DEFAULT', { id: 'c-2', answer: 'abcde' });
  expect(texts(tree)).toContain('Wrong username or password');
  expect(tree.root.findAllByType(Image).some(i => i.props.source?.uri === 'data:image/png;base64,CCCC')).toBe(true);
});

test('parent exams: subject-wise marks with their maximum, total when it adds something', async () => {
  fixtures['/student/exams'] = [
    {
      id: 1, name: 'Half yearly', status: 'completed', start_date: '2026-09-01', end_date: '2026-09-10',
      results_published: true, marks: 167, max_marks: 200, grade: null, remarks: null, total: 167, max_total: 200,
      subjects: [
        { subject: 'Maths', marks: 92, max_marks: 100, grade: 'A' },
        { subject: 'English', marks: 75, max_marks: 100, grade: null },
      ],
    },
    {
      id: 2, name: 'Unit test 1', status: 'completed', start_date: '2026-07-01', end_date: '2026-07-02',
      results_published: true, marks: 40, max_marks: 50, grade: 'B', remarks: 'Good', total: 33.5, max_total: 40,
      subjects: [
        { subject: 'Maths', marks: 18.5, max_marks: 20 },
        { subject: 'Science', marks: 15, max_marks: 20 },
      ],
    },
    // an older server: no subjects / maximum
    { id: 3, name: 'Class test', status: 'completed', start_date: '2026-06-01', end_date: '2026-06-01', results_published: true, marks: 9 },
    { id: 4, name: 'Finals', status: 'upcoming', start_date: '2027-03-01', end_date: '2027-03-10', results_published: false, subjects: [] },
  ];
  const tree = await render(<Exams />);
  const all = texts(tree);
  // Nov 2026: published results are a table — Subject | Marks | Out of | % | Grade — with a Total row
  expect(all).toContain('167 / 200 marks');
  expect(all).toContain('Maths | 92 | 100 | 92 | A');
  expect(all).toContain('English | 75 | 100 | 75 | —');
  expect(tree.root.findAll(n => n.props.testID === 'exam-subjects-1').length).toBeGreaterThan(0);
  expect(all.match(/Total \| /g)).toHaveLength(2);
  expect(all).toContain('Total | 167 | 200 | 83.5');
  expect(all).toContain('40 / 50 marks · Grade B');
  expect(all).toContain('Maths | 18.5 | 20 | 92.5');
  expect(all).toContain('Total | 33.5 | 40 | 83.8');
  expect(all).toContain('9 marks');
  expect(all).toContain('Results not published yet');
});
