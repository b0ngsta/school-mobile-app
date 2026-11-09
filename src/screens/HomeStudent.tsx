// Student/parent home — theme switcher entry. The two UIs live in
// screens/home/ (HomeStudent.default.tsx · HomeStudent.creative.tsx) and share
// their data through screens/home/useStudentHome.ts. Profile → Theme picks one.
import HomeStudentCreative from './home/HomeStudent.creative';
import HomeStudentDefault from './home/HomeStudent.default';
import { themedScreen } from './themed';

export default themedScreen({ default: HomeStudentDefault, creative: HomeStudentCreative }, 'HomeStudent');
