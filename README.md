# Interactive Network Visualization Workspace

A powerful, browser-based network analysis and visualization tool built with Next.js, D3.js, and Graphology. Designed for scientific research (such as Mineral Element Co-occurrence Networks), this application allows users to upload raw matrix/edge-list data, dynamically filter connections, run community detection algorithms, and interact with complex topologies in real-time.

## ✨ Features

- **Smart Upload Wizard**: Easily import network data via CSV or JSON. Supports multiple formats including Adjacency Matrices, Edge Lists, Bipartite, Unipartite, Directed, and Undirected graphs.
- **Real-Time Physics Engine**: Interactive D3.js force-directed graph rendering. Drag nodes, pan, zoom, and toggle live physics/frozen layouts.
- **Scientific Graph Analysis**: 
  - Integrated **Louvain Community Detection** (via Graphology) for identifying modular structures.
  - Accurate weight accumulation for undirected networks.
  - Calculation of in/out degrees and Modularity contribution metrics (Delta Q).
- **Dynamic Filtering**: Use intuitive UI sliders to filter out weak connections using both Absolute and Relative weight thresholds, or manually remove specific nodes.
- **"Gephi-Lite" Interface**: Seamlessly toggle between the visual **Graph** view and the spreadsheet-style **Data** view to inspect network metrics.
- **Performance Optimized**: Intelligent rendering limits SVG arrowheads and text labels on massive graphs to maintain high browser frame rates.
- **Dark/Light Mode**: Fully responsive UI with automated theme switching.

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (React)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Graph Visualization**: [D3.js](https://d3js.org/)
- **Graph Mathematics**: [Graphology](https://graphology.github.io/) & [graphology-communities-louvain](https://github.com/graphology/graphology-communities-louvain)
- **Data Parsing**: [PapaParse](https://www.papaparse.com/) (CSV)

## 🚀 Getting Started (Local Development)

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
   cd YOUR_REPOSITORY
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## 📂 Supported Data Formats

The built-in Smart Upload Wizard can parse a variety of CSV layouts, including:
- **Standard JSON**: Pre-formatted node/edge arrays.
- **Edge Lists**: `Source`, `Target`, `Weight` (Supports Bipartite and Unipartite).
- **Adjacency Matrices**: NxN grid of node relationships.
- **Dual Adjacency Matrices**: Using both raw counts and percentage matrices simultaneously.
