import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import EmergencyDetail from './pages/EmergencyDetail'
import Requests from './pages/Requests'
import Users from './pages/admin/Users'
import Institutions from './pages/admin/Institutions'
import Ambulances from './pages/admin/Ambulances'
import { AuthProvider } from './context/AuthContext'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          

          <Route path="/emergencias/:emergencyId" element={<EmergencyDetail />} />
          
          <Route path="/solicitudes" element={<Requests />} />
          
          <Route path="/admin/usuarios" element={<Users />} />
          <Route path="/admin/instituciones" element={<Institutions />} />
          <Route path="/admin/ambulancias" element={<Ambulances />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App