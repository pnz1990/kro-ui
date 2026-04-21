// Copyright 2026 The Kubernetes Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Route-based code splitting (spec issue-576 / 27.14).
// Each page is loaded as a separate chunk via React.lazy + dynamic import.
// This reduces the initial bundle from ~521 KB to the Layout + shared modules
// (~100–150 KB), with page chunks loaded on demand.
// The <Suspense> boundary in Layout.tsx shows a PageLoader while the chunk loads.

import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import './tokens.css'

// Layout and PageLoader are always-loaded — they are part of the shell.
import Layout from './components/Layout'
import PageLoader from './components/PageLoader'

// Page components loaded on demand — each becomes its own JS chunk.
const Home = lazy(() => import('./pages/Home'))
const Catalog = lazy(() => import('./pages/Catalog'))
const Fleet = lazy(() => import('./pages/Fleet'))
const InstancesPage = lazy(() => import('./pages/Instances'))
const RGDDetail = lazy(() => import('./pages/RGDDetail'))
const InstanceDetail = lazy(() => import('./pages/InstanceDetail'))
const Events = lazy(() => import('./pages/Events'))
const AuthorPage = lazy(() => import('./pages/AuthorPage'))
const NotFound = lazy(() => import('./pages/NotFound'))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/fleet" element={<Fleet />} />
            <Route path="/instances" element={<InstancesPage />} />
            <Route path="/events" element={<Events />} />
            <Route path="/author" element={<AuthorPage />} />
            <Route path="/rgds/:name" element={<RGDDetail />} />
            <Route path="/rgds/:rgdName/instances/:namespace/:instanceName" element={<InstanceDetail />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>,
)
