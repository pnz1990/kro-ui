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

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PageLoader from './PageLoader'

describe('PageLoader', () => {
  it('renders a status element accessible to screen readers', () => {
    render(<PageLoader />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('has aria-label describing loading state', () => {
    render(<PageLoader />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading page')
  })

  it('renders the shimmer bar', () => {
    const { container } = render(<PageLoader />)
    const bar = container.querySelector('.page-loader__bar')
    expect(bar).toBeInTheDocument()
    expect(bar).toHaveAttribute('aria-hidden', 'true')
  })
})
