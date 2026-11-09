/**
 * Nov 2026: Performance Report (parent), Full Syllabus, staff Syllabus upload,
 * results Excel upload (required maximum) and remark edit/delete.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Text } from 'react-native';
import { pick } from '@react-native-documents/picker';

const fixtures: Record<string, unknown> = {};
const calls: { path: string; opts?: { method?: string; body?: unknown } }[] = [];

jest.mock('../src/api', () => {
  const actual = jest.requireActual('../src/api');
  return {
    ...actual,
    api: jest.fn(async (path: string, opts?: { method?: string; body?: unknown }) => {
      calls.push({ path, opts });
      return fixtures[path] ?? (opts?.method ? {} : []);
    }),
  };
});

import PerformanceReport from '../src/screens/portal/PerformanceReport';
import FullSyllabus from '../src/screens/portal/FullSyllabus';
import Syllabus from '../src/screens/portal/Syllabus';
import StaffSyllabus from '../src/screens/staff/StaffSyllabus';
import ExamResultsSheet from '../src/screens/staff/ExamResultsSheet';
import StudentDetail from '../src/screens/staff/StudentDetail';
import { STUDENT_MENU, studentMenu } from '../src/screens/home/useStudentHome';
import {
  deltaText,
  radarPoint,
  segment,
  shortExam,
  shortSubject,
  subjectIcon,
  trendPoints,
  trendRange,
} from '../src/screens/portal/performance';
import type { ScreenProps, Session } from '../src/types';

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
afterEach(async () => {
  await ReactTestRenderer.act(async () => {
    mounted.splice(0).forEach(t => t.unmount());
  });
  Object.keys(fixtures).forEach(k => delete fixtures[k]);
  calls.splice(0);
});

const byId = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll(n => n.props.testID === id && typeof n.props.onPress === 'function')[0];
async function tap(node: ReactTestRenderer.ReactTestInstance) {
  await ReactTestRenderer.act(async () => {
    await node.props.onPress();
  });
}

function props(session: Partial<Session>, params: Record<string, unknown> = {}): ScreenProps {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    params,
    session: { user_id: 7, full_name: 'X', user_type: 'teacher', ...session } as Session,
    onLogout: jest.fn(),
  } as unknown as ScreenProps;
}

const REPORT = {
  session: { label: '2026-2027', start: '2026-04-01', end: '2027-03-31' },
  grades: [{ min: 91, grade: 'A1' }, { min: 81, grade: 'A2' }, { min: 71, grade: 'B1' }, { min: 0, grade: 'E' }],
  overall: {
    obtained: 462, max_total: 500, percentage: 92.4, grade: 'A1', rank: 4, class_size: 42, class_average: 78,
    vs_class: 14.4, exams_count: 2, subjects_count: 3,
  },
  exams: [
    { id: 1, name: 'UT-1', start_date: '2026-07-01', end_date: '2026-07-01', obtained: 78, max_total: 100, percentage: 78,
      grade: 'B1', class_average: 70, class_highest: 95, rank: 9, class_size: 42 },
    { id: 2, name: 'Half Yearly', start_date: '2026-09-20', end_date: '2026-09-28', obtained: 384, max_total: 400,
      percentage: 96, grade: 'A1', class_average: 80, class_highest: 98, rank: 2, class_size: 42 },
  ],
  subjects: ['English', 'Mathematics', 'Science'].map((s, i) => ({
    subject: s, obtained: 88 + i * 4, max_total: 100, percentage: 88 + i * 4, grade: 'A2', class_average: 76,
    class_highest: 99, vs_class: 12 + i * 4, rank: 3, class_size: 42, trend: 5,
    exams: [
      { exam_id: 1, exam: 'UT-1', marks: 40, max_marks: 50, absent: false, percentage: 80, grade: null, class_average: 70 },
      { exam_id: 2, exam: 'Half Yearly', marks: 92, max_marks: 100, absent: false, percentage: 92, grade: null, class_average: 78 },
    ],
  })),
  insights: [
    { kind: 'strongest', title: 'Strongest subject', text: 'Science (96%)', subject: 'Science' },
    { kind: 'focus', title: 'Focus area', text: 'English (88%)', subject: 'English' },
    { kind: 'above_average', title: 'Above class average', text: '+14.4% overall vs the class' },
  ],
};

test('chart helpers', () => {
  const s = segment({ x: 0, y: 0 }, { x: 10, y: 0 }, 2);
  expect(s).toEqual({ left: 0, top: -1, width: 10, angle: 0 });
  expect(Math.round(segment({ x: 0, y: 0 }, { x: 0, y: 10 }).angle)).toBe(90);
  const top = radarPoint(0, 5, 10, 50, 50);
  expect([Math.round(top.x), Math.round(top.y)]).toEqual([50, 40]);
  expect(trendRange([78, 84, 92.4]).min).toBe(60);
  expect(trendRange([]).ticks[0]).toBe(100);
  const pts = trendPoints([60, 100], 200, 100, 60);
  expect(pts.map(p => [p.x, p.y])).toEqual([[30, 100], [170, 0]]);
  expect([deltaText(12.04), deltaText(-3.5), deltaText(0), deltaText(null)]).toEqual(['+12%', '−3.5%', '±0%', '—']);
  expect([shortExam('Unit Test 2'), shortExam('UT-1'), shortExam('Half Yearly')]).toEqual(['UT-2', 'UT-1', 'Half\nYearly']);
  expect([shortSubject('Mathematics'), shortSubject('Social Science'), shortSubject('Hindi')]).toEqual(['Maths', 'S.St.', 'Hindi']);
  expect([subjectIcon('Mathematics'), subjectIcon('Hindi'), subjectIcon('Social Science'), subjectIcon('Yoga')])
    .toEqual(['pi', 'alphabetical-variant', 'earth', 'book-outline']);
});

test('performance report: overview, analysis and subjects tabs', async () => {
  fixtures['/student/performance'] = REPORT;
  fixtures['/student/report-cards'] = [{ id: 5, term: 'Term 1', grades: { maths: 'A' }, remarks: 'Good', created_at: '2026-10-01', issued_by: 'T' }];
  const tree = await render(<PerformanceReport {...props({ user_type: 'student' })} />);
  let all = texts(tree);
  expect(all).toContain('Performance Report');
  expect(all).toContain('Session 2026-2027');
  expect(all).toContain('Overall Performance');
  expect(all).toContain('Grade A1');
  expect(all).toContain('462 / 500  |  Class Rank 4 / 42');
  expect(all).toContain('Subject-wise Comparison');
  expect(all).toContain('Class avg 76%');
  expect(all).toContain('Report cards from school');
  expect(tree.root.findAll(n => n.props.testID === 'perf-hero').length).toBeGreaterThan(0);

  // tap a subject row → Subjects tab with that subject
  await tap(byId(tree, 'perf-subject-Mathematics'));
  all = texts(tree);
  expect(all).toContain('Exam by exam');
  expect(all).toContain('Rank 3 of 42 in class');
  expect(tree.root.findAll(n => n.props.testID === 'perf-subject-detail').length).toBeGreaterThan(0);

  await tap(byId(tree, 'perf-tab-analysis'));
  all = texts(tree);
  expect(all).toContain('Subject Mastery');
  expect(all).toContain('Performance Insights');
  expect(all).toContain('Science (96%)');
  expect(all).toContain('Performance Trend (Overall)');
  expect(all).toContain('Grade scale');
  // the last exam is selected; lay the charts out, then tap the first point
  expect(all).toContain('384/400 · 96%');
  await ReactTestRenderer.act(async () => {
    tree.root.findAll(n => typeof n.props.onLayout === 'function' && /perf-(trend|radar)/.test(n.props.testID || ''))
      .forEach(n => n.props.onLayout({ nativeEvent: { layout: { width: 320, height: 200 } } }));
  });
  expect(texts(tree)).toContain('Maths');
  await tap(byId(tree, 'perf-point-0'));
  expect(texts(tree)).toContain('78/100 · 78%');
});

test('performance report: nothing published yet', async () => {
  fixtures['/student/performance'] = { ...REPORT, overall: null, exams: [], subjects: [], insights: [] };
  const tree = await render(<PerformanceReport {...props({ user_type: 'student' })} />);
  expect(texts(tree)).toContain('No published results yet this session');
});

test('full syllabus: launcher only when the class has one; screen + syllabus card', async () => {
  expect(studentMenu(null)).toBe(STUDENT_MENU);
  expect(studentMenu({ full_syllabus: 0 } as never).some(m => m.route === 'FullSyllabus')).toBe(false);
  const menu = studentMenu({ full_syllabus: 1 } as never);
  const at = menu.findIndex(m => m.route === 'Syllabus');
  expect(menu[at + 1].route).toBe('FullSyllabus');
  expect(STUDENT_MENU.find(m => m.route === 'ReportCards')?.label).toBe('Performance Report');

  const doc = { id: 3, kind: 'syllabus', title: 'Syllabus 2026-27', subject: null, created_at: '2026-10-01',
    attachment_path: 'uploads/documents/a.pdf?exp=1&sig=x', attachment_type: 'pdf', attachment_name: 'all.pdf' };
  fixtures['/student/syllabus/full'] = [doc];
  fixtures['/student/syllabus'] = [{ subject: 'Maths', documents: [] }];
  const p = props({ user_type: 'student' });
  const tree = await render(<FullSyllabus {...p} />);
  expect(texts(tree)).toContain('Syllabus 2026-27');

  const syl = await render(<Syllabus {...p} />);
  expect(texts(syl)).toContain('Full Syllabus');
  const card = syl.root.findAll(n => n.props.accessibilityLabel === 'Full Syllabus' && typeof n.props.onPress === 'function')[0];
  await tap(card);
  expect(p.navigate).toHaveBeenCalledWith('FileViewer', expect.objectContaining({ path: doc.attachment_path }));
});

test('staff syllabus: lists full / subject syllabus, edit only own', async () => {
  fixtures['/documents?kind=syllabus&limit=100'] = [
    { id: 1, kind: 'syllabus', title: 'Class 5 full', subject: null, class_id: 5, class_name: 'Class 5', created_by: 7,
      created_at: '2026-10-01', attachment_path: 'uploads/a.pdf', attachment_type: 'pdf' },
    { id: 2, kind: 'syllabus', title: 'Maths', subject: 'Maths', class_id: 5, class_name: 'Class 5', created_by: 99,
      created_at: '2026-10-02', attachment_path: 'uploads/b.pdf', attachment_type: 'pdf' },
  ];
  fixtures['/classes'] = [{ id: 5, name: 'Class 5', subjects: ['Maths'], sections: [{ id: 51, name: 'A' }] }];
  fixtures['/assignments/mine'] = [{ id: 1, class_id: 5, section_id: 51, class_name: 'Class 5', section_name: 'A', role: 'subject_teacher' }];
  const tree = await render(<StaffSyllabus {...props({ user_type: 'teacher', user_id: 7 })} />);
  const all = texts(tree);
  expect(all).toContain('Class 5 full');
  expect(all).toContain('Full syllabus');
  expect(all).toContain('Maths');
  // edit buttons only on the teacher's own upload
  expect(tree.root.findAll(n => n.props.label === '✏️ Edit' && typeof n.props.onPress === 'function')).toHaveLength(1);
});

test('results sheet: table, template download and upload (class teacher only)', async () => {
  const path = '/exams/3/results/sheet?section_id=11';
  fixtures[path] = {
    exam: { id: 3, name: 'Term 1', status: 'completed', results_published: 0, max_marks: 100 },
    section: { id: 11, class_id: 1, class_name: 'Class 1', section_name: 'A' },
    subjects: [{ name: 'English', max_marks: 80 }, { name: 'Math', max_marks: 100 }],
    students: [{ student_id: 1, full_name: 'Asha', roll_no: '1', marks: { English: 72, Math: 'AB' }, total: 72,
      max_total: 180, percentage: 40 }],
    can_import: true,
  };
  fixtures['/exams/3/results/template?section_id=11&format=json'] = { filename: 'r.csv', content: 'student_id\n' };
  const tree = await render(<ExamResultsSheet {...props({ user_type: 'teacher' }, { examId: 3, sectionId: 11 })} />);
  let all = texts(tree);
  expect(all).toContain('Upload results with Excel');
  expect(all).toContain('Eng\n/80');
  expect(all).toContain('AB');
  expect(all).toContain('72/180');
  await tap(byId(tree, 'results-template'));
  expect(calls.some(c => c.path.endsWith('format=json'))).toBe(true);

  // "out of" is prefilled (exam maximum) and required
  const maxInput = () => tree.root.findAll(n => n.props.testID === 'results-max' && typeof n.props.onChangeText === 'function')[0];
  expect(maxInput().props.value).toBe('100');
  await ReactTestRenderer.act(async () => maxInput().props.onChangeText(''));
  await tap(byId(tree, 'results-upload'));
  expect(texts(tree)).toContain('Enter the maximum marks (out of) for this exam, e.g. 50 or 100');
  expect(calls.some(c => c.path.endsWith('/results/import'))).toBe(false);
  await ReactTestRenderer.act(async () => maxInput().props.onChangeText('50'));
  (pick as jest.Mock).mockResolvedValueOnce([{ uri: 'content://x/r.xlsx', name: 'r.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }]);
  fixtures['/exams/3/results/import'] = { saved: true, students: 1, marks: 2, absent: 0, remarks: 0, max_marks: 50, published: true, subjects: [] };
  await tap(byId(tree, 'results-upload'));
  const sent = calls.find(c => c.path === '/exams/3/results/import');
  expect(sent?.opts?.method).toBe('POST');
  expect(((sent?.opts as { formData?: FormData })?.formData as unknown as { getParts?: () => unknown[] })).toBeTruthy();
  expect(texts(tree)).toContain('published to parents');

  (fixtures[path] as { can_import: boolean }).can_import = false;
  const other = await render(<ExamResultsSheet {...props({ user_type: 'teacher' }, { examId: 3, sectionId: 11 })} />);
  all = texts(other);
  expect(all).toContain('Only the class teacher of this section can upload marks from Excel.');
  expect(other.root.findAll(n => n.props.testID === 'results-upload')).toHaveLength(0);
});

test('remarks: the author (or managers) can edit and delete', async () => {
  fixtures['/students/9'] = { id: 9, full_name: 'Asha' };
  fixtures['/students/9/remarks'] = [
    { id: 1, remark: 'Mine', created_by: 7, created_by_name: 'Teacher 7', created_at: '2026-10-01' },
    { id: 2, remark: 'Someone else', created_by: 8, created_by_name: 'Teacher 8', created_at: '2026-10-01' },
  ];
  const tree = await render(<StudentDetail {...props({ user_type: 'teacher', user_id: 7 }, { studentId: 9 })} />);
  const remarksTab = tree.root.findAll(n => typeof n.props.onChange === 'function' && Array.isArray(n.props.items))[0];
  await ReactTestRenderer.act(async () => remarksTab.props.onChange('remarks'));
  expect(texts(tree)).toContain('Teacher 7');
  expect(tree.root.findAll(n => n.props.testID === 'remark-edit-1').length).toBeGreaterThan(0);
  expect(tree.root.findAll(n => n.props.testID === 'remark-edit-2')).toHaveLength(0);

  // edit → PUT
  await tap(byId(tree, 'remark-edit-1'));
  const save = tree.root.findAll(n => n.props.label === 'Save changes' && typeof n.props.onPress === 'function')[0];
  await tap(save);
  expect(calls.some(c => c.path === '/students/9/remarks/1' && c.opts?.method === 'PUT')).toBe(true);

  // delete → confirm → DELETE
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.find(b => b.style === 'destructive')?.onPress?.();
  });
  await tap(byId(tree, 'remark-delete-1'));
  await ReactTestRenderer.act(async () => {});
  expect(calls.some(c => c.path === '/students/9/remarks/1' && c.opts?.method === 'DELETE')).toBe(true);
  alert.mockRestore();

  // a manager sees the buttons on every remark
  const admin = await render(<StudentDetail {...props({ user_type: 'admin', user_id: 1 }, { studentId: 9 })} />);
  const tab = admin.root.findAll(n => typeof n.props.onChange === 'function' && Array.isArray(n.props.items))[0];
  await ReactTestRenderer.act(async () => tab.props.onChange('remarks'));
  expect(admin.root.findAll(n => n.props.testID === 'remark-edit-2').length).toBeGreaterThan(0);
});
