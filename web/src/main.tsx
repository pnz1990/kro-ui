import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import './tokens.css'

import Layout from './components/Layout'
import Home from './pages/Home'
import Catalog from './pages/Catalog'
import Fleet from './pages/Fleet'
import RGDDetail from './pages/RGDDetail'
import InstanceDetail from './pages/InstanceDetail'
import Events from './pages/Events'
import AuthorPage from './pages/AuthorPage'
import NotFound from './pages/NotFound'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/fleet" element={<Fleet />} />
          <Route path="/events" element={<Events />} />
          <Route path="/author" element={<AuthorPage />} />
          <Route path="/rgds/:name" element={<RGDDetail />} />
          <Route path="/rgds/:rgdName/instances/:namespace/:instanceName" element={<InstanceDetail />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
