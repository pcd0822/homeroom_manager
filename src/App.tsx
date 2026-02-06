import { Routes, Route, Navigate } from 'react-router-dom'
import { AdminDashboard } from '@/pages/admin/Dashboard'
import { ResponseGridPage } from '@/pages/admin/ResponseGridPage'
import { FormView } from '@/pages/view/FormView'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/forms/:formId/responses" element={<ResponseGridPage />} />
      <Route path="/view/:formId" element={<FormView />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}

export default App
