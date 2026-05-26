import { Routes } from '@angular/router';
import { AdminLayout } from './components/admin-layout/admin-layout';
import { AdminDashboard } from './components/admin-dashboard/admin-dashboard';
import { AdminUsers } from './components/admin-users/admin-users';
import { AdminOrganizations } from './components/admin-organizations/admin-organizations';
import { AdminTaxonomies } from './components/admin-taxonomies/admin-taxonomies';
import { AdminPages } from './components/admin-pages/admin-pages';

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
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'admin/dashboard'
  }
];
