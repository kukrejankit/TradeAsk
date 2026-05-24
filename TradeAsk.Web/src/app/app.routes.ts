import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./components/question-form/question-form').then(m => m.QuestionForm) },
  { path: 'admin', loadComponent: () => import('./components/admin-dashboard/admin-dashboard').then(m => m.AdminDashboard) },
  { path: 'admin/documents', loadComponent: () => import('./components/document-manager/document-manager').then(m => m.DocumentManager) },
  { path: 'privacy', loadComponent: () => import('./components/privacy/privacy').then(m => m.Privacy) },
  { path: 'terms', loadComponent: () => import('./components/terms/terms').then(m => m.Terms) },
  { path: 'disclaimer', loadComponent: () => import('./components/disclaimer/disclaimer').then(m => m.Disclaimer) },
];
