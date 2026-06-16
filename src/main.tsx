import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './App'
import './index.css'
import { captureStudentApiFromUrl } from '@/lib/gasUrl'

// 학생 공유 링크(?api=)로 진입하면 GAS URL을 저장해 SPA 내부 이동에도 연결을 유지한다.
captureStudentApiFromUrl()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
)
