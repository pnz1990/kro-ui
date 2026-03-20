// KroCodeBlock — port of Amine's custom kro CEL/schema/YAML highlighter.
// Tokens: yamlKey, kroKeyword, celExpression, schemaType, schemaPipe, schemaKeyword, schemaValue, comment.
// TODO: implement

export default function KroCodeBlock({ code }: { code: string }) {
  return <pre style={{ fontFamily: 'var(--font-mono)' }}>{code}</pre>
}
