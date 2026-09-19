import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth-context';
import { Layout } from './ui/Layout';
import { Home } from './views/Home';
import { Login } from './views/Login';
import { Register } from './views/Register';
import { Courses } from './views/Courses';
import { Dashboard } from './views/Dashboard';
import { ModulePage } from './views/ModulePage';
import { PublicPage } from './views/PublicPage';
import { ExamRoom } from './views/ExamRoom';
import { Notebook } from './views/Notebook';
import { ExamBuilder } from './views/ExamBuilder';
import { ContentViewer } from './views/ContentViewer';
import { Profile } from './views/Profile';
import { CourseRoom } from './views/CourseRoom';
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
      <Route path="class/:level" element={<PublicPage type="class" />} />
      <Route path="admission" element={<PublicPage type="admission" />} />
      <Route path="teachers" element={<PublicPage type="teachers" />} />
      <Route path="books" element={<PublicPage type="books" />} />
      <Route path="notices" element={<PublicPage type="notices" />} />
      <Route path="about" element={<PublicPage type="about" />} />
      <Route path="contact" element={<PublicPage type="contact" />} />
      <Route path="faq" element={<PublicPage type="faq" />} />
      <Route path="login" element={<Login />} />
      <Route path="register" element={<Register />} />
      <Route path="dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="dashboard/:module" element={<Protected><ModulePage /></Protected>} />
      <Route path="profile" element={<Protected><Profile /></Protected>} />
      <Route path="course/:id" element={<Protected><CourseRoom /></Protected>} />
      <Route path="exam/:id" element={<Protected><ExamRoom /></Protected>} />
      <Route path="dashboard/exam-builder" element={<Protected><ExamBuilder /></Protected>} />
      <Route path="notebook/:id" element={<Protected><Notebook /></Protected>} />
      <Route path="learn/:id" element={<Protected><ContentViewer /></Protected>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Route>
  </Routes></AuthProvider>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>);
