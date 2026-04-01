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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Footer from './Footer'

// Mock api.getVersion so Footer doesn't hit the network
vi.mock('@/lib/api', () => ({
  getVersion: vi.fn().mockResolvedValue({ version: 'v1.2.3' }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Footer', () => {
  it('renders with role="contentinfo"', () => {
    render(<Footer />)
    expect(screen.getByRole('contentinfo')).toBeTruthy()
  })

  it('renders kro.run link', () => {
    render(<Footer />)
    const link = screen.getByRole('link', { name: 'kro.run' })
    expect(link).toBeTruthy()
    expect((link as HTMLAnchorElement).href).toContain('kro.run')
  })

  it('renders GitHub link', () => {
    render(<Footer />)
    const link = screen.getByRole('link', { name: 'GitHub' })
    expect(link).toBeTruthy()
    expect((link as HTMLAnchorElement).href).toContain('github.com')
  })

  it('renders License link', () => {
    render(<Footer />)
    expect(screen.getByRole('link', { name: 'License' })).toBeTruthy()
  })

  it('renders "kro-ui" text', () => {
    render(<Footer />)
    expect(screen.getByRole('contentinfo').textContent).toContain('kro-ui')
  })
})
