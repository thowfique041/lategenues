import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth-context';
import { Layout } from './ui/Layout';
import { Home } from './views/Home';
import { Login } from './views/Login';
import { Courses } from './views/Courses';
import { Dashboard } from './views/Dashboard';
import { ModulePage } from './views/ModulePage';
import './styles.css';

function Protected({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function App() {
  return <AuthProvider><Routes>
    <Route element={<Layout />}>
      <Route index element={<Home />} />
      <Route path="courses" element={<Courses />} />
      <Route path="login" element={<Login />} />
      <Route path="dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="dashboard/:module" element={<Protected><ModulePage /></Protected>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Route>
  </Routes></AuthProvider>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>);
