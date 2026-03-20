{{- define "kro-ui.fullname" -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "kro-ui.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{ include "kro-ui.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "kro-ui.selectorLabels" -}}
app.kubernetes.io/name: kro-ui
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "kro-ui.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "kro-ui.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
