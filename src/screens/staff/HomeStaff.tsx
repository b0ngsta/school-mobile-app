// Staff home (teacher / coordinator / sub admin / admin / principal / driver)
// — theme switcher entry. The two UIs live in screens/staff/home/
// (HomeStaff.default.tsx = classic tiles · HomeStaff.creative.tsx = orbit) and
// share their data through screens/staff/home/useStaffHome.ts.
// Profile → Theme (StaffProfile) picks one; default when nothing is chosen.
import { themedScreen } from '../themed';
import HomeStaffCreative from './home/HomeStaff.creative';
import HomeStaffDefault from './home/HomeStaff.default';

export default themedScreen({ default: HomeStaffDefault, creative: HomeStaffCreative }, 'HomeStaff');
