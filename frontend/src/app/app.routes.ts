import { Routes } from '@angular/router';
import { AdminLayout } from './components/admin-layout/admin-layout';
import { AdminDashboard } from './components/admin-dashboard/admin-dashboard';
import { AdminUsers } from './components/admin-users/admin-users';
import { AdminOrganizations } from './components/admin-organizations/admin-organizations';
import { AdminTaxonomies } from './components/admin-taxonomies/admin-taxonomies';
import { AdminPages } from './components/admin-pages/admin-pages';
import { AdminBlogs } from './components/admin-blogs/admin-blogs';
import { AdminEvents } from './components/admin-events/admin-events';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'admin/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'admin',
    component: AdminLayout,
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
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'admin/dashboard'
  }
];
