"""
Hyperion Resource Monitor - Visualization Module

Provides data visualization capabilities for metrics and resource usage,
including charts, dashboards, and exportable reports.
"""

import asyncio
import json
import logging
import time
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

logger = logging.getLogger(__name__)

# Optional imports - visualization capabilities will depend on these
try:
    import matplotlib
    matplotlib.use('Agg')  # Non-interactive backend
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    from matplotlib.colors import LinearSegmentedColormap
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False


class VisualizationRenderer:
    """
    Base class for visualization renderers
    
    Provides common functionality for different visualization formats.
    """
    
    def __init__(self, output_dir: Optional[str] = None):
        """
        Initialize visualization renderer
        
        Args:
            output_dir: Directory for saving visualizations
        """
        self.output_dir = output_dir or os.path.join(os.getcwd(), 'hyperion_viz')
        
        # Create output directory if it doesn't exist
        if output_dir and not os.path.exists(output_dir):
            try:
                os.makedirs(output_dir, exist_ok=True)
            except OSError as e:
                logger.warning(f"Failed to create visualization directory: {str(e)}")
    
    def render_visualization(
        self,
        data: Dict[str, Any],
        visualization_type: str,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Render a visualization
        
        Args:
            data: Data to visualize
            visualization_type: Type of visualization
            options: Optional rendering options
            
        Returns:
            Result information including paths or data
        """
        # Base implementation - subclasses should override
        return {
            'success': False,
            'error': 'Not implemented in base class'
        }
    
    def save_visualization(self, filename: str, content: bytes) -> str:
        """
        Save visualization to file
        
        Args:
            filename: Filename
            content: File content
            
        Returns:
            Full path to saved file
        """
        if not self.output_dir:
            raise ValueError("Output directory not configured")
            
        # Ensure filename has no path components
        safe_filename = os.path.basename(filename)
        
        # Add timestamp to filename
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        name, ext = os.path.splitext(safe_filename)
        timestamped_filename = f"{name}_{timestamp}{ext}"
        
        # Full path
        full_path = os.path.join(self.output_dir, timestamped_filename)
        
        # Save file
        with open(full_path, 'wb') as f:
            f.write(content)
            
        return full_path


class MatplotlibRenderer(VisualizationRenderer):
    """
    Matplotlib-based visualization renderer
    
    Creates static charts and visualizations using Matplotlib.
    """
    
    def __init__(self, output_dir: Optional[str] = None):
        """
        Initialize Matplotlib renderer
        
        Args:
            output_dir: Directory for saving visualizations
        """
        super().__init__(output_dir)
        self.supported_types = [
            'line_chart',
            'bar_chart',
            'stacked_area',
            'heatmap',
            'scatter_plot',
            'pie_chart',
            'histogram'
        ]
        
        if not HAS_MATPLOTLIB:
            logger.warning(
                "Matplotlib not available. Install with: pip install matplotlib"
            )
    
    def render_visualization(
        self,
        data: Dict[str, Any],
        visualization_type: str,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Render a visualization using Matplotlib
        
        Args:
            data: Data to visualize
            visualization_type: Type of visualization
            options: Optional rendering options
            
        Returns:
            Result information including paths or data
        """
        options = options or {}
        
        if not HAS_MATPLOTLIB:
            return {
                'success': False,
                'error': 'Matplotlib not available'
            }
            
        if visualization_type not in self.supported_types:
            return {
                'success': False,
                'error': f"Unsupported visualization type: {visualization_type}"
            }
            
        # Setup figure
        fig_width = options.get('width', 10)
        fig_height = options.get('height', 6)
        dpi = options.get('dpi', 100)
        
        fig, ax = plt.subplots(figsize=(fig_width, fig_height), dpi=dpi)
        
        try:
            # Create visualization based on type
            if visualization_type == 'line_chart':
                self._create_line_chart(ax, data, options)
            elif visualization_type == 'bar_chart':
                self._create_bar_chart(ax, data, options)
            elif visualization_type == 'stacked_area':
                self._create_stacked_area(ax, data, options)
            elif visualization_type == 'heatmap':
                self._create_heatmap(ax, data, options)
            elif visualization_type == 'scatter_plot':
                self._create_scatter_plot(ax, data, options)
            elif visualization_type == 'pie_chart':
                self._create_pie_chart(ax, data, options)
            elif visualization_type == 'histogram':
                self._create_histogram(ax, data, options)
            
            # Add title and labels
            title = options.get('title', 'Hyperion Visualization')
            plt.title(title)
            
            if 'xlabel' in options:
                plt.xlabel(options['xlabel'])
            if 'ylabel' in options:
                plt.ylabel(options['ylabel'])
                
            # Add legend if needed
            if options.get('legend', True) and visualization_type not in ['heatmap', 'pie_chart']:
                plt.legend()
                
            # Adjust layout
            plt.tight_layout()
            
            # Save to file if requested
            if options.get('save', False):
                filename = options.get('filename', f"{visualization_type}.png")
                
                # Save to BytesIO
                from io import BytesIO
                buf = BytesIO()
                plt.savefig(buf, format='png')
                buf.seek(0)
                
                # Save to file
                file_path = self.save_visualization(filename, buf.read())
                
                plt.close(fig)
                
                return {
                    'success': True,
                    'file_path': file_path,
                    'format': 'png'
                }
            
            # Return figure as data URL
            from io import BytesIO
            import base64
            
            buf = BytesIO()
            plt.savefig(buf, format='png')
            buf.seek(0)
            data_url = f"data:image/png;base64,{base64.b64encode(buf.read()).decode('utf-8')}"
            
            plt.close(fig)
            
            return {
                'success': True,
                'data_url': data_url,
                'format': 'png'
            }
            
        except Exception as e:
            plt.close(fig)
            logger.error(f"Visualization error: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }
    
    def _create_line_chart(
        self,
        ax: plt.Axes,
        data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> None:
        """
        Create a line chart
        
        Args:
            ax: Matplotlib axes
            data: Chart data
            options: Chart options
        """
        # Extract data
        x_data = data.get('x', [])
        series = data.get('series', [])
        
        # Handle datetime x axis
        x_is_datetime = options.get('x_datetime', False)
        if x_is_datetime:
            # Convert to datetime if needed
            if isinstance(x_data[0], (int, float)):
                x_data = [datetime.fromtimestamp(x) for x in x_data]
                
            # Format x-axis
            ax.xaxis.set_major_formatter(mdates.DateFormatter(options.get('date_format', '%H:%M:%S')))
            ax.xaxis.set_major_locator(mdates.AutoDateLocator())
        
        # Plot each series
        for s in series:
            name = s.get('name', 'Series')
            y_data = s.get('data', [])
            color = s.get('color')
            linestyle = s.get('linestyle', '-')
            marker = s.get('marker', None)
            
            # Plot the line
            ax.plot(
                x_data,
                y_data,
                label=name,
                color=color,
                linestyle=linestyle,
                marker=marker
            )
        
        # Add grid if requested
        if options.get('grid', True):
            ax.grid(True, linestyle='--', alpha=0.7)
    
    def _create_bar_chart(
        self,
        ax: plt.Axes,
        data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> None:
        """
        Create a bar chart
        
        Args:
            ax: Matplotlib axes
            data: Chart data
            options: Chart options
        """
        # Extract data
        categories = data.get('categories', [])
        series = data.get('series', [])
        
        # Handle multiple series
        if len(series) == 1:
            # Single series bar chart
            s = series[0]
            name = s.get('name', 'Series')
            y_data = s.get('data', [])
            color = s.get('color')
            
            # Plot bars
            ax.bar(
                categories,
                y_data,
                label=name,
                color=color,
                alpha=0.7
            )
        else:
            # Multiple series - grouped bars
            num_series = len(series)
            width = 0.8 / num_series  # Bar width
            
            for i, s in enumerate(series):
                name = s.get('name', f'Series {i+1}')
                y_data = s.get('data', [])
                color = s.get('color')
                
                # Calculate bar positions
                positions = [j - 0.4 + (i + 0.5) * width for j in range(len(categories))]
                
                # Plot bars
                ax.bar(
                    positions,
                    y_data,
                    width=width,
                    label=name,
                    color=color,
                    alpha=0.7
                )
            
            # Set x-ticks at category positions
            ax.set_xticks(range(len(categories)))
            ax.set_xticklabels(categories)
        
        # Customize appearance
        if options.get('horizontal', False):
            # Convert to horizontal bar chart
            ax.invert_yaxis()
            ax.set_xlim(0, max([max(s.get('data', [0])) for s in series]) * 1.1)
    
    def _create_stacked_area(
        self,
        ax: plt.Axes,
        data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> None:
        """
        Create a stacked area chart
        
        Args:
            ax: Matplotlib axes
            data: Chart data
            options: Chart options
        """
        # Extract data
        x_data = data.get('x', [])
        series = data.get('series', [])
        
        # Handle datetime x axis
        x_is_datetime = options.get('x_datetime', False)
        if x_is_datetime and isinstance(x_data[0], (int, float)):
            x_data = [datetime.fromtimestamp(x) for x in x_data]
        
        # Extract y data for each series
        y_data = [s.get('data', []) for s in series]
        labels = [s.get('name', f'Series {i+1}') for i, s in enumerate(series)]
        colors = [s.get('color') for s in series]
        
        # Plot stacked area
        ax.stackplot(
            x_data,
            y_data,
            labels=labels,
            colors=colors,
            alpha=0.7
        )
        
        # Customize appearance
        if x_is_datetime:
            ax.xaxis.set_major_formatter(mdates.DateFormatter(options.get('date_format', '%H:%M:%S')))
            ax.xaxis.set_major_locator(mdates.AutoDateLocator())
            
        # Add grid if requested
        if options.get('grid', True):
            ax.grid(True, linestyle='--', alpha=0.7)
    
    def _create_heatmap(
        self,
        ax: plt.Axes,
        data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> None:
        """
        Create a heatmap
        
        Args:
            ax: Matplotlib axes
            data: Chart data
            options: Chart options
        """
        if not HAS_NUMPY:
            raise ImportError("NumPy is required for heatmap visualization")
            
        # Extract data
        values = np.array(data.get('values', []))
        
        # Check for row and column labels
        row_labels = data.get('rows', range(values.shape[0]))
        col_labels = data.get('columns', range(values.shape[1]))
        
        # Create colormap
        cmap_name = options.get('colormap', 'viridis')
        cmap = plt.get_cmap(cmap_name)
        
        # Create heatmap
        im = ax.imshow(values, cmap=cmap)
        
        # Add colorbar
        cbar = plt.colorbar(im, ax=ax)
        if 'colorbar_label' in options:
            cbar.set_label(options['colorbar_label'])
        
        # Add ticks and labels
        ax.set_xticks(range(len(col_labels)))
        ax.set_xticklabels(col_labels)
        ax.set_yticks(range(len(row_labels)))
        ax.set_yticklabels(row_labels)
        
        # Rotate x-tick labels if requested
        if options.get('rotate_xlabels', False):
            plt.setp(ax.get_xticklabels(), rotation=45, ha='right')
        
        # Add cell values if requested
        if options.get('show_values', False):
            # Iterate over data and add text annotations
            for i in range(values.shape[0]):
                for j in range(values.shape[1]):
                    value = values[i, j]
                    # Determine text color based on cell color
                    threshold = options.get('text_color_threshold', 0.5)
                    text_color = 'white' if value > threshold else 'black'
                    
                    ax.text(
                        j, i, f"{value:.2f}",
                        ha='center', va='center',
                        color=text_color
                    )
    
    def _create_scatter_plot(
        self,
        ax: plt.Axes,
        data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> None:
        """
        Create a scatter plot
        
        Args:
            ax: Matplotlib axes
            data: Chart data
            options: Chart options
        """
        # Extract data
        series = data.get('series', [])
        
        # Plot each series
        for s in series:
            name = s.get('name', 'Series')
            x_data = s.get('x', [])
            y_data = s.get('y', [])
            
            # Optional size and color data
            sizes = s.get('sizes', None)
            colors = s.get('colors', None)
            
            # Default styling
            marker = s.get('marker', 'o')
            alpha = s.get('alpha', 0.7)
            color = s.get('color')
            
            # Create scatter plot
            sc = ax.scatter(
                x_data,
                y_data,
                s=sizes,
                c=colors,
                marker=marker,
                alpha=alpha,
                label=name,
                color=None if colors is not None else color
            )
            
            # Add colorbar if color data is provided
            if colors is not None:
                plt.colorbar(sc, ax=ax, label=s.get('color_label', 'Value'))
        
        # Add grid if requested
        if options.get('grid', True):
            ax.grid(True, linestyle='--', alpha=0.7)
    
    def _create_pie_chart(
        self,
        ax: plt.Axes,
        data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> None:
        """
        Create a pie chart
        
        Args:
            ax: Matplotlib axes
            data: Chart data
            options: Chart options
        """
        # Extract data
        values = data.get('values', [])
        labels = data.get('labels', [f"Segment {i+1}" for i in range(len(values))])
        
        # Optional styling
        colors = data.get('colors')
        explode = data.get('explode')
        
        # Create pie chart
        wedges, texts, autotexts = ax.pie(
            values,
            labels=None if options.get('legend_only', False) else labels,
            autopct='%1.1f%%' if options.get('show_percentages', True) else None,
            startangle=options.get('start_angle', 90),
            explode=explode,
            colors=colors,
            shadow=options.get('shadow', False)
        )
        
        # Customize text appearance
        if autotexts:
            for text in autotexts:
                text.set_color(options.get('percent_color', 'white'))
                text.set_fontsize(options.get('percent_fontsize', 10))
        
        # Add legend if requested
        if options.get('legend', True) and options.get('legend_only', False):
            ax.legend(wedges, labels, loc=options.get('legend_location', 'best'))
    
    def _create_histogram(
        self,
        ax: plt.Axes,
        data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> None:
        """
        Create a histogram
        
        Args:
            ax: Matplotlib axes
            data: Chart data
            options: Chart options
        """
        # Extract data
        values = data.get('values', [])
        
        # Optional styling
        bins = options.get('bins', 'auto')
        color = options.get('color', 'steelblue')
        alpha = options.get('alpha', 0.7)
        density = options.get('density', False)
        
        # Create histogram
        n, bins, patches = ax.hist(
            values,
            bins=bins,
            color=color,
            alpha=alpha,
            density=density,
            label=data.get('name', 'Histogram')
        )
        
        # Add KDE curve if requested
        if options.get('kde', False) and HAS_NUMPY:
            from scipy import stats
            import numpy as np
            
            # Calculate KDE
            kde = stats.gaussian_kde(values)
            x = np.linspace(min(values), max(values), 1000)
            y = kde(x)
            
            # Scale KDE to match histogram height
            if not density:
                scale = len(values) * (bins[1] - bins[0])
                y = y * scale
                
            # Plot KDE
            ax.plot(x, y, 'r-', linewidth=2, label='KDE')
        
        # Add cumulative distribution if requested
        if options.get('cumulative', False) and HAS_NUMPY:
            import numpy as np
            
            # Sort values
            sorted_values = np.sort(values)
            
            # Calculate cumulative distribution
            cumulative = np.arange(1, len(sorted_values) + 1) / len(sorted_values)
            
            # Plot cumulative distribution
            ax2 = ax.twinx()
            ax2.plot(
                sorted_values,
                cumulative,
                'g-',
                linewidth=2,
                label='Cumulative'
            )
            ax2.set_ylabel('Cumulative Frequency')
            ax2.set_ylim(0, 1)
            
            # Add secondary legend
            if options.get('legend', True):
                lines, labels = ax.get_legend_handles_labels()
                lines2, labels2 = ax2.get_legend_handles_labels()
                ax.legend(lines + lines2, labels + labels2, loc='best')


class HtmlRenderer(VisualizationRenderer):
    """
    HTML-based visualization renderer
    
    Creates interactive charts and dashboards using HTML, CSS, and JavaScript.
    """
    
    def __init__(self, output_dir: Optional[str] = None):
        """
        Initialize HTML renderer
        
        Args:
            output_dir: Directory for saving visualizations
        """
        super().__init__(output_dir)
        self.supported_types = [
            'dashboard',
            'interactive_chart',
            'metric_cards',
            'timeline',
            'resource_gauge'
        ]
    
    def render_visualization(
        self,
        data: Dict[str, Any],
        visualization_type: str,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Render a visualization using HTML
        
        Args:
            data: Data to visualize
            visualization_type: Type of visualization
            options: Optional rendering options
            
        Returns:
            Result information including paths or data
        """
        options = options or {}
        
        if visualization_type not in self.supported_types:
            return {
                'success': False,
                'error': f"Unsupported visualization type: {visualization_type}"
            }
            
        try:
            # Create visualization based on type
            if visualization_type == 'dashboard':
                html_content = self._create_dashboard(data, options)
            elif visualization_type == 'interactive_chart':
                html_content = self._create_interactive_chart(data, options)
            elif visualization_type == 'metric_cards':
                html_content = self._create_metric_cards(data, options)
            elif visualization_type == 'timeline':
                html_content = self._create_timeline(data, options)
            elif visualization_type == 'resource_gauge':
                html_content = self._create_resource_gauge(data, options)
            else:
                return {
                    'success': False,
                    'error': f"Visualization type not implemented: {visualization_type}"
                }
                
            # Save to file if requested
            if options.get('save', False):
                filename = options.get('filename', f"{visualization_type}.html")
                
                # Save to file
                file_path = self.save_visualization(filename, html_content.encode('utf-8'))
                
                return {
                    'success': True,
                    'file_path': file_path,
                    'format': 'html'
                }
            
            # Return HTML content
            return {
                'success': True,
                'html': html_content,
                'format': 'html'
            }
            
        except Exception as e:
            logger.error(f"Visualization error: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }
    
    def _create_dashboard(
        self,
        data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> str:
        """
        Create a dashboard visualization
        
        Args:
            data: Dashboard data
            options: Dashboard options
            
        Returns:
            HTML content
        """
        # Extract data
        title = options.get('title', 'Hyperion Resource Monitor Dashboard')
        theme = options.get('theme', 'light')
        refresh_interval = options.get('refresh_interval', 0)  # 0 means no auto-refresh
        
        # Start building HTML
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        :root {{
            --bg-color: {self._get_theme_color(theme, 'background')};
            --text-color: {self._get_theme_color(theme, 'text')};
            --border-color: {self._get_theme_color(theme, 'border')};
            --card-bg: {self._get_theme_color(theme, 'card')};
            --primary-color: {self._get_theme_color(theme, 'primary')};
            --secondary-color: {self._get_theme_color(theme, 'secondary')};
            --success-color: {self._get_theme_color(theme, 'success')};
            --warning-color: {self._get_theme_color(theme, 'warning')};
            --danger-color: {self._get_theme_color(theme, 'danger')};
        }}
        
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            margin: 0;
            padding: 0;
        }}
        
        .dashboard {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            grid-gap: 20px;
            padding: 20px;
        }}
        
        .header {{
            background-color: var(--primary-color);
            color: white;
            padding: 1rem;
            text-align: center;
            grid-column: 1 / -1;
        }}
        
        .card {{
            background-color: var(--card-bg);
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            padding: 20px;
            overflow: hidden;
        }}
        
        .card-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 10px;
            margin-bottom: 15px;
        }}
        
        .card-title {{
            font-size: 1.2rem;
            font-weight: 600;
            margin: 0;
        }}
        
        .card-subtitle {{
            font-size: 0.9rem;
            color: #777;
            margin: 5px 0 0 0;
        }}
        
        .metric {{
            font-size: 2rem;
            font-weight: bold;
            text-align: center;
            margin: 20px 0;
        }}
        
        .metric.success {{
            color: var(--success-color);
        }}
        
        .metric.warning {{
            color: var(--warning-color);
        }}
        
        .metric.danger {{
            color: var(--danger-color);
        }}
        
        .chart-container {{
            width: 100%;
            height: 300px;
        }}
        
        .footer {{
            grid-column: 1 / -1;
            text-align: center;
            padding: 10px;
            color: #777;
            font-size: 0.8rem;
        }}
        
        @media (max-width: 768px) {{
            .dashboard {{
                grid-template-columns: 1fr;
            }}
        }}
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.7.1/chart.min.js"></script>
</head>
<body>
    <div class="header">
        <h1>{title}</h1>
        <p>{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
    </div>
    
    <div class="dashboard">
"""
        
        # Add cards for each section
        sections = data.get('sections', [])
        for section in sections:
            section_type = section.get('type', 'metric')
            section_title = section.get('title', 'Section')
            section_subtitle = section.get('subtitle', '')
            
            html += f"""
        <div class="card">
            <div class="card-header">
                <h2 class="card-title">{section_title}</h2>
                <p class="card-subtitle">{section_subtitle}</p>
            </div>
"""
            
            if section_type == 'metric':
                # Metric card
                value = section.get('value', 0)
                unit = section.get('unit', '')
                status = section.get('status', 'normal')
                
                html += f"""
            <div class="metric {status}">{value}{unit}</div>
"""
            elif section_type == 'chart':
                # Chart card
                chart_data = section.get('data', {})
                chart_type = section.get('chart_type', 'line')
                chart_id = f"chart_{hash(str(time.time()) + section_title) & 0xFFFFFFFF}"
                
                html += f"""
            <div class="chart-container">
                <canvas id="{chart_id}"></canvas>
            </div>
            <script>
                (function() {{
                    const ctx = document.getElementById('{chart_id}').getContext('2d');
                    const chart = new Chart(ctx, {json.dumps(self._convert_to_chartjs(chart_data, chart_type))});
                }})();
            </script>
"""
            
            html += """
        </div>
"""
        
        # Add footer
        html += f"""
        <div class="footer">
            Generated by Hyperion Resource Monitor on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        </div>
    </div>
"""
        
        # Add auto-refresh if requested
        if refresh_interval > 0:
            html += f"""
    <script>
        // Auto-refresh
        setTimeout(function() {{
            location.reload();
        }}, {refresh_interval * 1000});
    </script>
"""
        
        # Close HTML
        html += """
</body>
</html>
"""
        
        return html
    
    def _create_interactive_chart(
        self,
        data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> str:
        """
        Create an interactive chart visualization
        
        Args:
            data: Chart data
            options: Chart options
            
        Returns:
            HTML content
        """
        # Extract options
        title = options.get('title', 'Interactive Chart')
        chart_type = options.get('chart_type', 'line')
        theme = options.get('theme', 'light')
        height = options.get('height', 400)
        width = options.get('width', '100%')
        
        # Generate a unique ID for the chart
        chart_id = f"chart_{hash(str(time.time()) + title) & 0xFFFFFFFF}"
        
        # Start building HTML
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: {self._get_theme_color(theme, 'background')};
            color: {self._get_theme_color(theme, 'text')};
            margin: 0;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}
        
        .chart-header {{
            margin-bottom: 20px;
            text-align: center;
        }}
        
        .chart-container {{
            background-color: {self._get_theme_color(theme, 'card')};
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            padding: 20px;
            height: {height}px;
            width: {width};
            margin: 0 auto;
        }}
        
        .controls {{
            display: flex;
            justify-content: center;
            margin-top: 20px;
            gap: 10px;
        }}
        
        button {{
            background-color: {self._get_theme_color(theme, 'primary')};
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 16px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.2s;
        }}
        
        button:hover {{
            background-color: {self._get_theme_color(theme, 'secondary')};
        }}
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.7.1/chart.min.js"></script>
</head>
<body>
    <div class="container">
        <div class="chart-header">
            <h1>{title}</h1>
        </div>
        
        <div class="chart-container">
            <canvas id="{chart_id}"></canvas>
        </div>
        
        <div class="controls">
            <button id="downloadBtn">Download as PNG</button>
            <button id="toggleTypeBtn">Toggle Chart Type</button>
        </div>
    </div>
    
    <script>
        // Chart initialization
        const ctx = document.getElementById('{chart_id}').getContext('2d');
        let chartConfig = {json.dumps(self._convert_to_chartjs(data, chart_type))};
        let currentType = '{chart_type}';
        let chart = new Chart(ctx, chartConfig);
        
        // Toggle chart type
        document.getElementById('toggleTypeBtn').addEventListener('click', function() {{
            if (currentType === 'line') {{
                currentType = 'bar';
            }} else {{
                currentType = 'line';
            }}
            
            // Update chart type
            chart.destroy();
            chartConfig.type = currentType;
            chart = new Chart(ctx, chartConfig);
        }});
        
        // Download as PNG
        document.getElementById('downloadBtn').addEventListener('click', function() {{
            const link = document.createElement('a');
            link.download = '{title.replace(" ", "_")}.png';
            link.href = document.getElementById('{chart_id}').toDataURL('image/png');
            link.click();
        }});
    </script>
</body>
</html>
"""
        
        return html
    
    def _create_metric_cards(
        self,
        data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> str:
        """
        Create metric cards visualization
        
        Args:
            data: Metrics data
            options: Visualization options
            
        Returns:
            HTML content
        """
        # Extract options
        title = options.get('title', 'System Metrics')
        theme = options.get('theme', 'light')
        layout = options.get('layout', 'grid')  # 'grid' or 'flex'
        
        # Extract metrics
        metrics = data.get('metrics', [])
        
        # Start building HTML
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: {self._get_theme_color(theme, 'background')};
            color: {self._get_theme_color(theme, 'text')};
            margin: 0;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}
        
        .header {{
            text-align: center;
            margin-bottom: 40px;
        }}
        
        .metrics-container {{
"""
        
        if layout == 'grid':
            html += """
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            grid-gap: 20px;
"""
        else:  # flex
            html += """
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            justify-content: center;
"""
        
        html += """
        }
        
        .metric-card {
            background-color: var(--card-bg);
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            padding: 20px;
            text-align: center;
"""
        
        if layout == 'flex':
            html += """
            flex: 0 0 300px;
"""
        
        html += """
        }
        
        .metric-icon {
            font-size: 2rem;
            margin-bottom: 10px;
        }
        
        .metric-title {
            font-size: 1.2rem;
            font-weight: 600;
            margin-bottom: 5px;
        }
        
        .metric-value {
            font-size: 2.5rem;
            font-weight: bold;
            margin: 15px 0;
        }
        
        .metric-value.success {
            color: var(--success-color);
        }
        
        .metric-value.warning {
            color: var(--warning-color);
        }
        
        .metric-value.danger {
            color: var(--danger-color);
        }
        
        .metric-subtitle {
            font-size: 0.9rem;
            color: #777;
        }
        
        /* Theme variables */
        :root {
            --bg-color: """
        html += self._get_theme_color(theme, 'background')
        html += """;
            --text-color: """
        html += self._get_theme_color(theme, 'text')
        html += """;
            --card-bg: """
        html += self._get_theme_color(theme, 'card')
        html += """;
            --success-color: """
        html += self._get_theme_color(theme, 'success')
        html += """;
            --warning-color: """
        html += self._get_theme_color(theme, 'warning')
        html += """;
            --danger-color: """
        html += self._get_theme_color(theme, 'danger')
        html += """;
        }
    </style>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>"""
        html += title
        html += """</h1>
            <p>Current system metrics as of """
        html += datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        html += """</p>
        </div>
        
        <div class="metrics-container">
"""
        
        # Add metric cards
        for metric in metrics:
            metric_name = metric.get('name', 'Metric')
            metric_value = metric.get('value', 0)
            metric_unit = metric.get('unit', '')
            metric_icon = metric.get('icon', 'fas fa-chart-line')
            metric_status = metric.get('status', 'normal')
            metric_description = metric.get('description', '')
            
            html += f"""
            <div class="metric-card">
                <div class="metric-icon">
                    <i class="{metric_icon}"></i>
                </div>
                <div class="metric-title">{metric_name}</div>
                <div class="metric-value {metric_status}">{metric_value}{metric_unit}</div>
                <div class="metric-subtitle">{metric_description}</div>
            </div>
"""
        
        # Close HTML
        html += """
        </div>
    </div>
</body>
</html>
"""
        
        return html
    
    def _create_timeline(
        self,
        data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> str:
        """
        Create a timeline visualization
        
        Args:
            data: Timeline data
            options: Visualization options
            
        Returns:
            HTML content
        """
        # Extract options
        title = options.get('title', 'System Timeline')
        theme = options.get('theme', 'light')
        
        # Extract events
        events = data.get('events', [])
        
        # Start building HTML
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: {self._get_theme_color(theme, 'background')};
            color: {self._get_theme_color(theme, 'text')};
            margin: 0;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1000px;
            margin: 0 auto;
        }}
        
        .header {{
            text-align: center;
            margin-bottom: 40px;
        }}
        
        .timeline {{
            position: relative;
            max-width: 800px;
            margin: 0 auto;
        }}
        
        .timeline::after {{
            content: '';
            position: absolute;
            width: 6px;
            background-color: {self._get_theme_color(theme, 'primary')};
            top: 0;
            bottom: 0;
            left: 50%;
            margin-left: -3px;
        }}
        
        .event {{
            padding: 10px 40px;
            position: relative;
            width: 50%;
            box-sizing: border-box;
        }}
        
        .event::after {{
            content: '';
            position: absolute;
            width: 20px;
            height: 20px;
            background-color: white;
            border: 4px solid {self._get_theme_color(theme, 'primary')};
            border-radius: 50%;
            top: 15px;
            z-index: 1;
        }}
        
        .left {{
            left: 0;
        }}
        
        .right {{
            left: 50%;
        }}
        
        .left::after {{
            right: -12px;
        }}
        
        .right::after {{
            left: -12px;
        }}
        
        .content {{
            padding: 20px;
            background-color: {self._get_theme_color(theme, 'card')};
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }}
        
        .timestamp {{
            font-size: 0.8rem;
            color: #777;
            margin-bottom: 5px;
        }}
        
        .event-title {{
            font-size: 1.2rem;
            font-weight: 600;
            margin: 0 0 10px 0;
        }}
        
        .event-description {{
            margin: 0;
        }}
        
        .event-type {{
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8rem;
            margin-bottom: 10px;
        }}
        
        .event-type.info {{
            background-color: {self._get_theme_color(theme, 'primary')};
            color: white;
        }}
        
        .event-type.warning {{
            background-color: {self._get_theme_color(theme, 'warning')};
            color: black;
        }}
        
        .event-type.error {{
            background-color: {self._get_theme_color(theme, 'danger')};
            color: white;
        }}
        
        .event-type.success {{
            background-color: {self._get_theme_color(theme, 'success')};
            color: white;
        }}
        
        @media screen and (max-width: 768px) {{
            .timeline::after {{
                left: 31px;
            }}
            
            .event {{
                width: 100%;
                padding-left: 70px;
                padding-right: 20px;
            }}
            
            .left::after, .right::after {{
                left: 19px;
            }}
            
            .right {{
                left: 0;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{title}</h1>
            <p>System events timeline</p>
        </div>
        
        <div class="timeline">
"""
        
        # Add events to timeline
        for i, event in enumerate(events):
            event_time = event.get('time', '')
            if isinstance(event_time, (int, float)):
                # Convert timestamp to datetime
                event_time = datetime.fromtimestamp(event_time).strftime('%Y-%m-%d %H:%M:%S')
                
            event_title = event.get('title', f'Event {i+1}')
            event_description = event.get('description', '')
            event_type = event.get('type', 'info')
            event_class = 'left' if i % 2 == 0 else 'right'
            
            html += f"""
            <div class="event {event_class}">
                <div class="content">
                    <div class="timestamp">{event_time}</div>
                    <span class="event-type {event_type}">{event_type.upper()}</span>
                    <h2 class="event-title">{event_title}</h2>
                    <p class="event-description">{event_description}</p>
                </div>
            </div>
"""
        
        # Close HTML
        html += """
        </div>
    </div>
</body>
</html>
"""
        
        return html
    
    def _create_resource_gauge(
        self,
        data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> str:
        """
        Create a resource gauge visualization
        
        Args:
            data: Gauge data
            options: Visualization options
            
        Returns:
            HTML content
        """
        # Extract options
        title = options.get('title', 'Resource Usage')
        theme = options.get('theme', 'light')
        
        # Extract gauge data
        gauges = data.get('gauges', [])
        
        # Start building HTML
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: {self._get_theme_color(theme, 'background')};
            color: {self._get_theme_color(theme, 'text')};
            margin: 0;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}
        
        .header {{
            text-align: center;
            margin-bottom: 40px;
        }}
        
        .gauges-container {{
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 30px;
        }}
        
        .gauge-card {{
            background-color: {self._get_theme_color(theme, 'card')};
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            padding: 20px;
            text-align: center;
            width: 300px;
        }}
        
        .gauge-title {{
            font-size: 1.2rem;
            font-weight: 600;
            margin-bottom: 20px;
        }}
        
        .gauge {{
            width: 200px;
            height: 100px;
            margin: 0 auto;
            position: relative;
            overflow: hidden;
        }}
        
        .gauge-background {{
            width: 200px;
            height: 200px;
            border-radius: 50%;
            border: 10px solid #f0f0f0;
            border-top-color: transparent;
            border-right-color: transparent;
            transform: rotate(45deg);
            box-sizing: border-box;
            position: absolute;
            top: 0;
            left: 0;
        }}
        
        .gauge-fill {{
            width: 200px;
            height: 200px;
            border-radius: 50%;
            border-width: 10px;
            border-style: solid;
            border-top-color: transparent;
            border-right-color: transparent;
            transform: rotate(45deg);
            box-sizing: border-box;
            position: absolute;
            top: 0;
            left: 0;
            transition: all 0.5s ease-in-out;
        }}
        
        .gauge-cover {{
            width: 160px;
            height: 160px;
            border-radius: 50%;
            background-color: {self._get_theme_color(theme, 'card')};
            position: absolute;
            top: 20px;
            left: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.1);
        }}
        
        .gauge-value {{
            font-size: 1.8rem;
            font-weight: bold;
            transform: rotate(-45deg);
        }}
        
        .gauge-details {{
            margin-top: 20px;
            font-size: 0.9rem;
        }}
        
        .low {{
            border-color: {self._get_theme_color(theme, 'success')};
            border-top-color: transparent;
            border-right-color: transparent;
        }}
        
        .medium {{
            border-color: {self._get_theme_color(theme, 'warning')};
            border-top-color: transparent;
            border-right-color: transparent;
        }}
        
        .high {{
            border-color: {self._get_theme_color(theme, 'danger')};
            border-top-color: transparent;
            border-right-color: transparent;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{title}</h1>
            <p>Current resource usage gauges</p>
        </div>
        
        <div class="gauges-container">
"""
        
        # Add gauge cards
        for gauge in gauges:
            gauge_name = gauge.get('name', 'Resource')
            gauge_value = gauge.get('value', 0)
            gauge_min = gauge.get('min', 0)
            gauge_max = gauge.get('max', 100)
            gauge_unit = gauge.get('unit', '%')
            gauge_details = gauge.get('details', '')
            
            # Calculate percentage for gauge display
            percentage = min(1.0, max(0.0, (gauge_value - gauge_min) / (gauge_max - gauge_min)))
            angle_percentage = percentage * 0.5  # Half circle = 0.5
            
            # Determine color class
            if percentage < 0.6:
                color_class = 'low'
            elif percentage < 0.85:
                color_class = 'medium'
            else:
                color_class = 'high'
            
            html += f"""
            <div class="gauge-card">
                <div class="gauge-title">{gauge_name}</div>
                <div class="gauge">
                    <div class="gauge-background"></div>
                    <div class="gauge-fill {color_class}" style="transform: rotate(calc(45deg + {angle_percentage} * 360deg))"></div>
                    <div class="gauge-cover">
                        <div class="gauge-value">{gauge_value}{gauge_unit}</div>
                    </div>
                </div>
                <div class="gauge-details">{gauge_details}</div>
            </div>
"""
        
        # Close HTML
        html += """
        </div>
    </div>
</body>
</html>
"""
        
        return html
    
    def _convert_to_chartjs(
        self,
        data: Dict[str, Any],
        chart_type: str
    ) -> Dict[str, Any]:
        """
        Convert Hyperion data format to Chart.js format
        
        Args:
            data: Hyperion chart data
            chart_type: Chart type
            
        Returns:
            Chart.js configuration
        """
        # Base configuration
        config = {
            'type': chart_type,
            'data': {
                'labels': [],
                'datasets': []
            },
            'options': {
                'responsive': True,
                'plugins': {
                    'legend': {
                        'position': 'top',
                    },
                    'title': {
                        'display': True,
                        'text': data.get('title', 'Chart')
                    }
                }
            }
        }
        
        # Add appropriate data based on chart type
        if chart_type in ['line', 'bar']:
            # For line and bar charts, extract labels and datasets
            config['data']['labels'] = data.get('x', [])
            
            # Convert to timestamps if they are datetime objects
            if config['data']['labels'] and isinstance(config['data']['labels'][0], datetime):
                config['data']['labels'] = [dt.timestamp() * 1000 for dt in config['data']['labels']]
                
                # Add time configuration
                config['options']['scales'] = {
                    'x': {
                        'type': 'time',
                        'time': {
                            'unit': 'minute'
                        }
                    }
                }
            
            # Add datasets
            for series in data.get('series', []):
                dataset = {
                    'label': series.get('name', 'Series'),
                    'data': series.get('data', []),
                    'borderColor': series.get('color'),
                    'backgroundColor': series.get('color', 'rgba(0, 123, 255, 0.5)'),
                    'borderWidth': 2,
                    'tension': 0.1
                }
                
                if chart_type == 'bar':
                    # Make bars semi-transparent
                    if isinstance(dataset['backgroundColor'], str) and dataset['backgroundColor'].startswith('rgb'):
                        # Convert from rgb to rgba with 0.7 opacity
                        dataset['backgroundColor'] = dataset['backgroundColor'].replace('rgb', 'rgba').replace(')', ', 0.7)')
                
                config['data']['datasets'].append(dataset)
        
        elif chart_type == 'pie' or chart_type == 'doughnut':
            # For pie and doughnut charts
            config['data']['labels'] = data.get('labels', [])
            
            dataset = {
                'data': data.get('values', []),
                'backgroundColor': data.get('colors', []),
                'borderWidth': 1
            }
            
            config['data']['datasets'].append(dataset)
        
        return config
    
    def _get_theme_color(self, theme: str, element: str) -> str:
        """
        Get color for specific theme and element
        
        Args:
            theme: Theme name
            element: Element name
            
        Returns:
            Color value
        """
        themes = {
            'light': {
                'background': '#f9f9f9',
                'text': '#333333',
                'border': '#e0e0e0',
                'card': '#ffffff',
                'primary': '#007bff',
                'secondary': '#6c757d',
                'success': '#28a745',
                'warning': '#ffc107',
                'danger': '#dc3545'
            },
            'dark': {
                'background': '#121212',
                'text': '#f5f5f5',
                'border': '#2d2d2d',
                'card': '#1e1e1e',
                'primary': '#0d6efd',
                'secondary': '#6c757d',
                'success': '#198754',
                'warning': '#ffc107',
                'danger': '#dc3545'
            },
            'blue': {
                'background': '#f0f8ff',
                'text': '#333333',
                'border': '#d0e0f0',
                'card': '#ffffff',
                'primary': '#0066cc',
                'secondary': '#5a89b8',
                'success': '#2E8B57',
                'warning': '#FF8C00',
                'danger': '#B22222'
            }
        }
        
        # Default to light theme if theme not found
        theme_colors = themes.get(theme, themes['light'])
        
        # Return requested color or default
        return theme_colors.get(element, '#000000')


class VisualizationManager:
    """
    Central manager for visualization capabilities
    
    Coordinates multiple renderers and provides a unified interface for
    creating and managing visualizations.
    """
    
    def __init__(self, output_dir: Optional[str] = None):
        """
        Initialize visualization manager
        
        Args:
            output_dir: Directory for saving visualizations
        """
        self.output_dir = output_dir
        self.renderers = {}
        self.init_renderers()
    
    def init_renderers(self) -> None:
        """Initialize visualization renderers"""
        # Add Matplotlib renderer if available
        if HAS_MATPLOTLIB:
            self.renderers['matplotlib'] = MatplotlibRenderer(self.output_dir)
            
        # Add HTML renderer
        self.renderers['html'] = HtmlRenderer(self.output_dir)
    
    async def create_visualization(
        self,
        data: Dict[str, Any],
        visualization_type: str,
        renderer_type: Optional[str] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a visualization
        
        Args:
            data: Data to visualize
            visualization_type: Type of visualization
            renderer_type: Type of renderer to use (or auto-select if None)
            options: Optional rendering options
            
        Returns:
            Result information including paths or data
        """
        options = options or {}
        
        # Select appropriate renderer
        if renderer_type is None:
            # Auto-select renderer based on visualization type
            if visualization_type in ['line_chart', 'bar_chart', 'scatter_plot', 'heatmap', 'pie_chart', 'histogram']:
                renderer_type = 'matplotlib' if 'matplotlib' in self.renderers else 'html'
            else:
                renderer_type = 'html'
        
        # Check if renderer is available
        if renderer_type not in self.renderers:
            return {
                'success': False,
                'error': f"Renderer not available: {renderer_type}"
            }
            
        # Get renderer
        renderer = self.renderers[renderer_type]
        
        # Create visualization
        result = renderer.render_visualization(data, visualization_type, options)
        
        return result
    
    def get_available_renderers(self) -> List[str]:
        """
        Get list of available renderers
        
        Returns:
            List of renderer names
        """
        return list(self.renderers.keys())
    
    def get_supported_visualizations(self, renderer_type: Optional[str] = None) -> Dict[str, List[str]]:
        """
        Get supported visualization types
        
        Args:
            renderer_type: Optional renderer type to check
            
        Returns:
            Dictionary of renderer -> supported visualization types
        """
        if renderer_type:
            if renderer_type in self.renderers:
                return {renderer_type: getattr(self.renderers[renderer_type], 'supported_types', [])}
            return {}
            
        # Get supported types for all renderers
        supported = {}
        for name, renderer in self.renderers.items():
            supported[name] = getattr(renderer, 'supported_types', [])
            
        return supported
