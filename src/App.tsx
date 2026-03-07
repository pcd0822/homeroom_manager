import { Routes, Route, Navigate } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { AdminDashboard } from '@/pages/admin/Dashboard'
import { FormBuilderPage } from '@/pages/admin/FormBuilderPage'
import { ResponseGridPage } from '@/pages/admin/ResponseGridPage'
import { SmsPage } from '@/pages/admin/SmsPage'
import { StudentsPage } from '@/pages/admin/StudentsPage'
import { RecordDashboardPage } from '@/pages/admin/RecordDashboardPage'
import { RecordStudentDashboardPage } from '@/pages/admin/RecordStudentDashboardPage'
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
      </Route>
      <Route path="/view/:formId" element={<FormView />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}

export default App
