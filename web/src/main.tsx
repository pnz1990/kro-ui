import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import './tokens.css'

import Layout from './components/Layout'
import Home from './pages/Home'
import RGDDetail from './pages/RGDDetail'
import InstanceDetail from './pages/InstanceDetail'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/rgds/:name" element={<RGDDetail />} />
          <Route path="/rgds/:rgdName/instances/:namespace/:instanceName" element={<InstanceDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
