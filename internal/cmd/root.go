// Package cmd wires the cobra CLI for kro-ui.
package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/pnz1990/kro-ui/internal/server"
	"github.com/pnz1990/kro-ui/internal/version"
)

var (
	port       int
	kubeconfig string
	context    string
)

var rootCmd = &cobra.Command{
	Use:   "kro-ui",
	Short: "Web dashboard for kro ResourceGraphDefinitions",
	Long: `kro-ui is a read-only web dashboard for kro.
It connects to your cluster via kubeconfig and provides:
  - DAG visualization of ResourceGraphDefinitions
  - Live instance observability with auto-refresh
  - CEL/schema highlighting aligned with kro.run

Run 'kro-ui serve' to start the dashboard.`,
}

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "Start the kro-ui web server",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg := server.Config{
			Port:       port,
			Kubeconfig: kubeconfig,
			Context:    context,
		}
		return server.Run(cfg)
	},
}

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print version information",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println(version.String())
	},
}

func init() {
	serveCmd.Flags().IntVarP(&port, "port", "p", 10174, "Port to listen on (10174 = k,r,o)")
	serveCmd.Flags().StringVar(&kubeconfig, "kubeconfig", "", "Path to kubeconfig (defaults to $KUBECONFIG or ~/.kube/config)")
	serveCmd.Flags().StringVar(&context, "context", "", "Kubernetes context to use (defaults to current context)")

	rootCmd.AddCommand(serveCmd)
	rootCmd.AddCommand(versionCmd)
}

// Execute is the entrypoint called from main.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
