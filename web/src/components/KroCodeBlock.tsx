// KroCodeBlock — port of Amine's custom kro CEL/schema/YAML highlighter.
// Tokens: yamlKey, kroKeyword, celExpression, schemaType, schemaPipe, schemaKeyword, schemaValue, comment.
// TODO: implement full highlighter (spec 006-cel-highlighter)

import { useCapabilities } from '../lib/features'

export default function KroCodeBlock({ code }: { code: string }) {
  const { capabilities } = useCapabilities()

  // CELOmitFunction gate: when true, omit() should be highlighted as a kro keyword.
  // The actual highlighting logic is delivered by spec 006-cel-highlighter.
  // For now this is a pass-through — the gate is wired and ready for consumption.
  const omitEnabled = capabilities.featureGates.CELOmitFunction

  return (
    <pre
      style={{ fontFamily: 'var(--font-mono)' }}
      data-omit-enabled={omitEnabled ? 'true' : undefined}
    >
      {code}
    </pre>
  )
}
