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
import { render } from '@testing-library/react'
import PermissionCell from './PermissionCell'

describe('PermissionCell', () => {
  it('renders a <td> element', () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <PermissionCell granted={true} verb="get" />
          </tr>
        </tbody>
      </table>,
    )
    expect(container.querySelector('td')).not.toBeNull()
  })

  it('renders ✓ and granted CSS class when granted=true', () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <PermissionCell granted={true} verb="get" />
          </tr>
        </tbody>
      </table>,
    )
    const td = container.querySelector('td')!
    expect(td.classList.contains('perm-cell--granted')).toBe(true)
    expect(td.textContent).toContain('✓')
  })

  it('renders ✗ and denied CSS class when granted=false', () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <PermissionCell granted={false} verb="create" />
          </tr>
        </tbody>
      </table>,
    )
    const td = container.querySelector('td')!
    expect(td.classList.contains('perm-cell--denied')).toBe(true)
    expect(td.textContent).toContain('✗')
  })

  it('sets aria-label to "<verb> granted" when granted', () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <PermissionCell granted={true} verb="list" />
          </tr>
        </tbody>
      </table>,
    )
    expect(container.querySelector('[aria-label="list granted"]')).not.toBeNull()
  })

  it('sets aria-label to "<verb> denied" when not granted', () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <PermissionCell granted={false} verb="delete" />
          </tr>
        </tbody>
      </table>,
    )
    expect(container.querySelector('[aria-label="delete denied"]')).not.toBeNull()
  })
})
