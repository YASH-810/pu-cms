import { Routes } from '@angular/router';
import { AdminLayout } from './components/admin-layout/admin-layout';
import { AdminDashboard } from './components/admin-dashboard/admin-dashboard';
import { AdminUsers } from './components/admin-users/admin-users';
import { AdminOrganizations } from './components/admin-organizations/admin-organizations';
import { AdminTaxonomies } from './components/admin-taxonomies/admin-taxonomies';
import { AdminPages } from './components/admin-pages/admin-pages';
import { AdminBlogs } from './components/admin-blogs/admin-blogs';
import { AdminEvents } from './components/admin-events/admin-events';
import { AdminAnnouncements } from './components/admin-announcements/admin-announcements';
import { AdminAchievements } from './components/admin-achievements/admin-achievements';
import { AdminStories } from './components/admin-stories/admin-stories';
import { AdminClubs } from './components/admin-clubs/admin-clubs';
import { AdminNotifications } from './components/admin-notifications/admin-notifications';
import { AdminUnifiedContent } from './components/admin-unified-content/admin-unified-content';
import { LoginPage } from './components/login/login';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginPage
  },
  {
    path: '',
    redirectTo: 'admin/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'admin',
    component: AdminLayout,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        component: AdminDashboard
      },
      {
        path: 'content',
        component: AdminUnifiedContent,
        data: { view: 'all' }
      },
      {
        path: 'review-queue',
        component: AdminUnifiedContent,
        data: { view: 'review' }
      },
      {
        path: 'published',
        component: AdminUnifiedContent,
        data: { view: 'published' }
      },
      {
        path: 'archived',
        component: AdminUnifiedContent,
        data: { view: 'archived' }
      },
      {
        path: 'users',
        component: AdminUsers
      },
      {
        path: 'organizations',
        component: AdminOrganizations
      },
      {
        path: 'taxonomies',
        component: AdminTaxonomies
      },
      {
        path: 'pages',
        component: AdminPages
      },
      {
        path: 'blogs',
        component: AdminBlogs
      },
      {
        path: 'events',
        component: AdminEvents
      },
      {
        path: 'announcements',
        component: AdminAnnouncements
      },
      {
        path: 'achievements',
        component: AdminAchievements
      },
      {
        path: 'stories',
        component: AdminStories
      },
      {
        path: 'clubs',
        component: AdminClubs
      },
      {
        path: 'notifications',
        component: AdminNotifications
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
