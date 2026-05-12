import { Routes, Route, Navigate } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { AdminDashboard } from '@/pages/admin/Dashboard'
import { FormBuilderPage } from '@/pages/admin/FormBuilderPage'
import { ResponseGridPage } from '@/pages/admin/ResponseGridPage'
import { SmsPage } from '@/pages/admin/SmsPage'
import { StudentsPage } from '@/pages/admin/StudentsPage'
import { RecordDashboardPage } from '@/pages/admin/RecordDashboardPage'
import { RecordStudentDashboardPage } from '@/pages/admin/RecordStudentDashboardPage'
import { CleaningZonesPage } from '@/pages/admin/CleaningZonesPage'
import { MealBoardPage } from '@/pages/admin/MealBoardPage'
import { NightStudyPage } from '@/pages/admin/NightStudyPage'
import { ClassGamesPage } from '@/pages/admin/ClassGamesPage'
import { ClassGameRankingPage } from '@/pages/admin/ClassGameRankingPage'
import { HomeRunGamePage } from '@/pages/game/HomeRunGamePage'
import { CleaningResultPage } from '@/pages/CleaningResultPage'
import { StudentMealBoardPage } from '@/pages/StudentMealBoardPage'
import { StudentDashboardHubPage } from '@/pages/StudentDashboardHubPage'
import { StudentPoliciesPage } from '@/pages/student/StudentPoliciesPage'
import { PolicyBoardSharedPage } from '@/pages/student/PolicyBoardSharedPage'
import { StudentSeedLedgerPage } from '@/pages/student/StudentSeedLedgerPage'
import { StudentPolicyRegisterPage } from '@/pages/student/StudentPolicyRegisterPage'
import { PoliciesAdminPage } from '@/pages/admin/PoliciesAdminPage'
import { SeatingPage } from '@/pages/admin/SeatingPage'
import { SeatingDrawPage } from '@/pages/SeatingDrawPage'
import { TeacherQuizEditPage } from '@/pages/admin/TeacherQuizEditPage'
import { TeacherQuizRankingPage } from '@/pages/admin/TeacherQuizRankingPage'
import { TeacherQuizPlayPage } from '@/pages/TeacherQuizPlayPage'
import { FormView } from '@/pages/view/FormView'
import { RegisterPage } from '@/pages/RegisterPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="forms/new" element={<FormBuilderPage />} />
        <Route path="forms/:formId/responses" element={<ResponseGridPage />} />
        <Route path="sms" element={<SmsPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="record-dashboard" element={<RecordDashboardPage />} />
        <Route path="record-dashboard/:studentId" element={<RecordStudentDashboardPage />} />
        <Route path="cleaning-zones" element={<CleaningZonesPage />} />
        <Route path="meal-board" element={<MealBoardPage />} />
        <Route path="night-study" element={<NightStudyPage />} />
        <Route path="class-games/teacher-quiz/edit" element={<TeacherQuizEditPage />} />
        <Route path="class-games/teacher-quiz/ranking" element={<TeacherQuizRankingPage />} />
        <Route path="class-games/:gameId/ranking" element={<ClassGameRankingPage />} />
        <Route path="class-games" element={<ClassGamesPage />} />
        <Route path="policies" element={<PoliciesAdminPage />} />
        <Route path="seating" element={<SeatingPage />} />
      </Route>
      <Route path="/view/:formId" element={<FormView />} />
      <Route path="/seating-draw" element={<SeatingDrawPage />} />
      <Route path="/cleaning-result" element={<CleaningResultPage />} />
      <Route path="/student/dashboard" element={<StudentDashboardHubPage />} />
      <Route path="/student/meal-board" element={<StudentMealBoardPage />} />
      <Route path="/student/policies" element={<StudentPoliciesPage />} />
      <Route path="/student/policy-board" element={<PolicyBoardSharedPage />} />
      <Route path="/student/seed-ledger" element={<StudentSeedLedgerPage />} />
      <Route path="/student/policy/register" element={<StudentPolicyRegisterPage />} />
      <Route path="/game/home-run" element={<HomeRunGamePage />} />
      <Route path="/play/teacher-quiz" element={<TeacherQuizPlayPage />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}

export default App
