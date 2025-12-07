// Skill Tree Visualization using D3.js
class SkillTreeVisualization {
    constructor(container, state) {
        this.container = container;
        this.state = state;
        this.root = null;
        this.margin = { top: 20, right: 120, bottom: 20, left: 120 };
        this.zoom = d3.zoom();
        this.currentTransform = d3.zoomIdentity;
        this.defaultZoom = 0.7; // Default zoom level (70%)
        this.jobSkills = new Set(); // Skills from job skill tree
        this.candidateSkills = new Set(); // Skills from candidate resume
        this.skillSimilarities = null; // Similarity data from Grok API
        
        // Ensure container is empty before creating SVG
        if (container) {
            container.innerHTML = '';
        }
        
        // Initialize SVG
        this.width = container.clientWidth - this.margin.left - this.margin.right;
        this.height = Math.max(600, container.clientHeight) - this.margin.top - this.margin.bottom;
        
        this.svg = d3.select(container)
            .append('svg')
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom)
            .style('font', '14px sans-serif');
        
        // Create container group for zoom
        this.zoomContainer = this.svg.append('g')
            .attr('class', 'zoom-container');
        
        this.g = this.zoomContainer.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
        
        // Set up zoom behavior
        this.zoom
            .scaleExtent([0.1, 3]) // Min and max zoom levels
            .on('zoom', (event) => {
                this.currentTransform = event.transform;
                this.zoomContainer.attr('transform', event.transform);
            });
        
        // Apply zoom to SVG
        this.svg.call(this.zoom);
        
        // Set initial zoom
        this.resetZoom();
        
        // Set up tree layout
        this.treeLayout = d3.tree()
            .size([this.height, this.width])
            .separation((a, b) => (a.parent === b.parent ? 1 : 1.5) / a.depth);
    }
    
    resetZoom() {
        // Calculate center position
        const svgWidth = this.width + this.margin.left + this.margin.right;
        const svgHeight = this.height + this.margin.top + this.margin.bottom;
        const centerX = svgWidth / 2;
        const centerY = svgHeight / 2;
        
        // Reset to default zoom and center
        // Translate to center, then scale, then translate back
        const transform = d3.zoomIdentity
            .translate(centerX, centerY)
            .scale(this.defaultZoom)
            .translate(-centerX, -centerY);
        
        this.currentTransform = transform;
        this.svg.transition()
            .duration(750)
            .call(this.zoom.transform, transform);
    }

    update(tree, candidateTree = null, similarityData = null) {
        // Clear previous render
        this.g.selectAll('*').remove();
        
        // Extract job skills
        this.jobSkills = this.extractSkills(tree);
        
        // Extract candidate skills if provided
        if (candidateTree) {
            this.candidateSkills = this.extractSkills(candidateTree);
        } else {
            this.candidateSkills = new Set();
        }
        
        // Store similarity data from Grok API
        this.skillSimilarities = similarityData;
        
        // Convert data to hierarchy
        const root = d3.hierarchy(tree);
        this.root = root;
        
        // Calculate tree layout
        this.treeLayout(root);
        
        // Draw links
        this.drawLinks(root);
        
        // Draw nodes
        this.drawNodes(root);
        
        // Preserve current zoom transform
        if (this.currentTransform) {
            this.zoomContainer.attr('transform', this.currentTransform);
        }
    }
    
    extractSkills(node, skillSet = new Set()) {
        if (node.type === 'skill' || node.type === 'requirement') {
            skillSet.add(node.name.toLowerCase());
        }
        if (node.children) {
            node.children.forEach(child => this.extractSkills(child, skillSet));
        }
        return skillSet;
    }

    drawLinks(root) {
        const links = root.links();
        
        const link = this.g.selectAll('.link')
            .data(links)
            .enter()
            .append('path')
            .attr('class', 'link')
            .attr('d', d3.linkHorizontal()
                .x(d => d.y)
                .y(d => d.x))
            .style('fill', 'none')
            .style('stroke', '#e4e4e7')
            .style('stroke-width', 2)
            .style('transition', 'stroke 0.3s ease');
    }

    drawNodes(root) {
        const nodes = root.descendants();
        
        const node = this.g.selectAll('.node')
            .data(nodes)
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.y},${d.x})`);
        
        // Add node circles
        node.append('circle')
            .attr('r', d => {
                if (d.data.type === 'skill' || d.data.type === 'requirement') return 8;
                if (d.children) return 6;
                return 4;
            })
            .style('fill', d => {
                if (d.data.type === 'skill' || d.data.type === 'requirement') {
                    const skillName = d.data.name;
                    const skillNameLower = skillName.toLowerCase();
                    
                    // Use Grok similarity data if available
                    if (this.skillSimilarities && this.skillSimilarities.matches) {
                        // Check if this job skill has a match in candidate skills
                        const match = this.skillSimilarities.matches.find(m => 
                            m.job_skill.toLowerCase() === skillNameLower
                        );
                        
                        if (match) {
                            // Yellow for matching skills (found by Grok)
                            return '#eab308';
                        }
                    } else {
                        // Fallback: simple matching if no Grok data
                        const isMatch = this.candidateSkills.has(skillNameLower) && this.jobSkills.has(skillNameLower);
                        if (isMatch) {
                            return '#eab308';
                        }
                    }
                    
                    // Check if this is a candidate-only skill (not in job requirements)
                    if (this.skillSimilarities && this.skillSimilarities.candidate_only) {
                        const isCandidateOnly = this.skillSimilarities.candidate_only.some(cs => 
                            cs.toLowerCase() === skillNameLower
                        );
                        if (isCandidateOnly) {
                            // Red for candidate-only skills
                            return '#ef4444';
                        }
                    } else if (this.candidateSkills.has(skillNameLower) && !this.jobSkills.has(skillNameLower)) {
                        // Fallback: red if candidate has it but job doesn't
                        return '#ef4444';
                    }
                    
                    // Default: progress-based colors for job skills
                    const progress = this.state.skillProgress.get(d.data.name) || 0;
                    if (progress === 100) return '#16a34a';
                    if (progress > 0) return '#3b82f6';
                    return '#e4e4e7';
                }
                return '#f4f4f5';
            })
            .style('stroke', '#09090b')
            .style('stroke-width', 1.5)
            .style('transition', 'all 0.3s ease')
            .on('mouseover', function() {
                d3.select(this).attr('r', 10).style('filter', 'brightness(1.1)');
            })
            .on('mouseout', function(d) {
                const r = (d.data.type === 'skill' || d.data.type === 'requirement') ? 8 : (d.children ? 6 : 4);
                d3.select(this).attr('r', r).style('filter', 'none');
            });
        
        // Add node labels
        const labels = node.append('g')
            .attr('class', 'node-label')
            .attr('transform', d => `translate(${d.children ? -13 : 13}, 0)`);
        
        labels.append('text')
            .attr('dy', '.35em')
            .attr('x', d => d.children ? -8 : 8)
            .style('text-anchor', d => d.children ? 'end' : 'start')
            .style('font-size', d => {
                if (d.data.type === 'skill' || d.data.type === 'requirement') return '14px';
                if (d.depth === 0) return '16px';
                return '13px';
            })
            .style('font-weight', d => {
                if (d.data.type === 'skill' || d.data.type === 'requirement') return '600';
                if (d.depth <= 1) return '600';
                return '400';
            })
            .style('fill', '#09090b')
            .style('pointer-events', 'none')
            .style('user-select', 'none')
            .text(d => d.data.name);
        
        // Add progress indicators for skills
        nodes.forEach(d => {
            if (d.data.type === 'skill' || d.data.type === 'requirement') {
                const progress = this.state.skillProgress.get(d.data.name) || 0;
                if (progress > 0) {
                    const progressGroup = this.g.append('g')
                        .attr('class', 'progress-indicator')
                        .attr('transform', `translate(${d.y},${d.x})`);
                    
                    const offset = d.children ? -13 : 13;
                    const anchor = d.children ? 'end' : 'start';
                    const xPos = d.children ? -8 : 8;
                    
                    progressGroup.append('rect')
                        .attr('x', d.children ? xPos - 40 : xPos)
                        .attr('y', -6)
                        .attr('width', 40)
                        .attr('height', 4)
                        .attr('rx', 2)
                        .style('fill', '#f4f4f5');
                    
                    progressGroup.append('rect')
                        .attr('x', d.children ? xPos - 40 : xPos)
                        .attr('y', -6)
                        .attr('width', (40 * progress) / 100)
                        .attr('height', 4)
                        .attr('rx', 2)
                        .style('fill', progress === 100 ? '#16a34a' : '#3b82f6')
                        .style('transition', 'width 0.3s ease');
                }
            }
        });
    }

    updateProgress(skillName, progress, candidateTree = null, similarityData = null) {
        // Update the state
        this.state.skillProgress.set(skillName, progress);
        
        // Re-render to show updated progress
        if (this.state.skillTree) {
            this.update(this.state.skillTree, candidateTree, similarityData);
        }
    }

    resize() {
        this.width = this.container.clientWidth - this.margin.left - this.margin.right;
        this.height = Math.max(600, this.container.clientHeight) - this.margin.top - this.margin.bottom;
        
        this.svg
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom);
        
        this.treeLayout.size([this.height, this.width]);
        
        if (this.state.skillTree) {
            this.update(this.state.skillTree);
        }
    }
    
    zoomOut() {
        const currentScale = this.currentTransform.k;
        const newScale = Math.max(0.1, currentScale * 0.8);
        const svgWidth = this.width + this.margin.left + this.margin.right;
        const svgHeight = this.height + this.margin.top + this.margin.bottom;
        const centerX = svgWidth / 2;
        const centerY = svgHeight / 2;
        
        const transform = d3.zoomIdentity
            .translate(centerX, centerY)
            .scale(newScale)
            .translate(-centerX, -centerY);
        
        this.currentTransform = transform;
        this.svg.transition()
            .duration(300)
            .call(this.zoom.transform, transform);
    }
    
    zoomIn() {
        const currentScale = this.currentTransform.k;
        const newScale = Math.min(3, currentScale * 1.25);
        const svgWidth = this.width + this.margin.left + this.margin.right;
        const svgHeight = this.height + this.margin.top + this.margin.bottom;
        const centerX = svgWidth / 2;
        const centerY = svgHeight / 2;
        
        const transform = d3.zoomIdentity
            .translate(centerX, centerY)
            .scale(newScale)
            .translate(-centerX, -centerY);
        
        this.currentTransform = transform;
        this.svg.transition()
            .duration(300)
            .call(this.zoom.transform, transform);
    }
}

// Export for use in main app
if (typeof window !== 'undefined') {
    window.SkillTreeVisualization = SkillTreeVisualization;
}

