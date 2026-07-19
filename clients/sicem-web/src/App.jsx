import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import EmergencyDetail from './pages/EmergencyDetail'
import Requests from './pages/Requests'
import Users from './pages/admin/Users'
import Institutions from './pages/admin/Institutions'
import Ambulances from './pages/admin/Ambulances'
import { AuthProvider } from './context/AuthContext'
import NewEmergency from './pages/NewEmergency'
import Hospitals from './pages/Hospitals'
import Charts from './pages/Charts'



function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          

          <Route path="/emergencias/nueva" element={<NewEmergency />} />
          <Route path="/emergencias/:emergencyId" element={<EmergencyDetail />} />
          
          <Route path="/solicitudes" element={<Requests />} />

          <Route path="/hospitales" element={<Hospitals />} />

          <Route path="/graficas" element={<Charts />} />

          <Route path="/admin/usuarios" element={<Users />} />
          <Route path="/admin/instituciones" element={<Institutions />} />
          <Route path="/admin/ambulancias" element={<Ambulances />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App