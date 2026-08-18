export const downloadStringAsFile = (content: string, filename: string, type: string = 'text/plain') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadBlobAsFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportElementAsImage = async (element: HTMLElement | null, filename: string, isDarkMode = false) => {
  if (!element) return;
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(element, {
    backgroundColor: isDarkMode ? '#141414' : '#ffffff',
    scale: Math.max(2, window.devicePixelRatio || 1),
    logging: false,
    useCORS: true,
    allowTaint: false,
    onclone: (documentClone) => {
      const legendClone = documentClone.getElementById(element.id);
      legendClone?.querySelectorAll('input[type="color"]').forEach((input) => input.remove());
      if (!legendClone) return;

      // Tailwind 4 uses oklab/color-mix for several computed colors, which
      // html2canvas 1.x cannot parse. Resolve every painted color through the
      // browser first and inline a plain RGBA value on the cloned tree.
      const converter = document.createElement('canvas');
      converter.width = 1;
      converter.height = 1;
      const converterContext = converter.getContext('2d', { willReadFrequently: true });
      const toRgba = (value: string) => {
        if (!converterContext || !value) return value;
        converterContext.clearRect(0, 0, 1, 1);
        converterContext.fillStyle = '#000000';
        converterContext.fillStyle = value;
        converterContext.fillRect(0, 0, 1, 1);
        const [red, green, blue, alpha] = converterContext.getImageData(0, 0, 1, 1).data;
        return `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`;
      };
      const colorProperties = [
        'color', 'backgroundColor', 'borderTopColor', 'borderRightColor',
        'borderBottomColor', 'borderLeftColor', 'outlineColor',
        'textDecorationColor', 'fill', 'stroke',
      ] as const;
      const originalNodes = [element, ...Array.from(element.querySelectorAll<HTMLElement | SVGElement>('*'))];
      const clonedNodes = [legendClone, ...Array.from(legendClone.querySelectorAll<HTMLElement | SVGElement>('*'))];
      originalNodes.forEach((originalNode, index) => {
        const clonedNode = clonedNodes[index];
        if (!clonedNode) return;
        const computed = window.getComputedStyle(originalNode);
        colorProperties.forEach((property) => {
          const value = computed[property];
          if (value) clonedNode.style.setProperty(property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), toRgba(value), 'important');
        });
        clonedNode.style.setProperty('box-shadow', 'none', 'important');
        if (computed.backgroundImage.includes('oklab') || computed.backgroundImage.includes('color-mix')) {
          clonedNode.style.setProperty('background-image', 'none', 'important');
        }
      });
    },
  });
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    try {
      canvas.toBlob(resolve, 'image/png');
    } catch (error) {
      reject(error);
    }
  });
  if (!blob) throw new Error('The legend could not be encoded as a PNG image.');
  downloadBlobAsFile(blob, filename);
};

export const exportSvg = (svgElement: SVGSVGElement | null, filename: string) => {
  if (!svgElement) return;
  const serializer = new XMLSerializer();
  
  // Clone to avoid modifying the original during export if we needed to inline styles
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  
  // Get SVG string
  const source = serializer.serializeToString(clone);
  
  // Add namespaces if missing
  let svgString = source;
  if (!svgString.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
    svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!svgString.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
    svgString = svgString.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  }

  // Prepend XML declaration
  svgString = '<?xml version="1.0" standalone="no"?>\r\n' + svgString;
  
  downloadStringAsFile(svgString, filename, 'image/svg+xml;charset=utf-8');
};

export const exportImage = (svgElement: SVGSVGElement | null, format: 'png' | 'jpeg', filename: string, isDarkMode: boolean = false) => {
  if (!svgElement) return;

  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  
  // Find zoom group to get actual content bounding box
  const zoomGroupDom = svgElement.querySelector('.zoom-group') as SVGGElement | null;
  const zoomGroupClone = clone.querySelector('.zoom-group') as SVGGElement | null;
  
  let exportWidth = 2000;
  let exportHeight = 2000;

  if (zoomGroupDom && zoomGroupClone) {
    // Calculate bounding box manually based on visible nodes to avoid huge invisible SVG elements
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const nodeGroups = zoomGroupDom.querySelectorAll('.node-group');
    
    nodeGroups.forEach(group => {
      if (group.getAttribute('display') === 'none') return;
      const transform = group.getAttribute('transform');
      if (transform) {
        const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        if (match) {
          const x = parseFloat(match[1]);
          const y = parseFloat(match[2]);
          const circle = group.querySelector('circle.node-shape');
          const r = circle ? parseFloat(circle.getAttribute('r') || '0') : 0;
          
          if (x - r < minX) minX = x - r;
          if (x + r > maxX) maxX = x + r;
          if (y - r < minY) minY = y - r;
          if (y + r > maxY) maxY = y + r;
        }
      }
    });

    if (minX !== Infinity && maxX !== -Infinity && minY !== Infinity && maxY !== -Infinity) {
      const padding = 100;
      const vbX = minX - padding;
      const vbY = minY - padding;
      const vbWidth = (maxX - minX) + padding * 2;
      const vbHeight = (maxY - minY) + padding * 2;
      
      // Set viewBox on clone to exactly match the content
      clone.setAttribute('viewBox', `${vbX} ${vbY} ${vbWidth} ${vbHeight}`);
      
      // Remove the current zoom transform from the clone so it doesn't get offset
      zoomGroupClone.removeAttribute('transform');
      
      // Set explicit export dimensions based on bounding box ratio to ensure high res
      exportWidth = Math.max(4000, vbWidth * 2); // High resolution base width
      exportHeight = exportWidth * (vbHeight / vbWidth);
      
      clone.setAttribute('width', `${exportWidth}`);
      clone.setAttribute('height', `${exportHeight}`);
    }
  } else {
    exportWidth = (svgElement.clientWidth || 1000) * 4;
    exportHeight = (svgElement.clientHeight || 1000) * 4;
    clone.setAttribute('width', `${exportWidth}`);
    clone.setAttribute('height', `${exportHeight}`);
  }

  // Inline basic styles to ensure text and lines render correctly in canvas
  const style = document.createElement('style');
  style.textContent = `
    .node-label { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 10px; font-weight: 500; }
    .graph-link { fill: none; }
  `;
  clone.insertBefore(style, clone.firstChild);

  // Prepend XML declaration and namespaces
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(clone);
  
  if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
    source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  }
  source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
  
  const img = new Image();
  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set background if it's jpeg or if we want a solid background
    if (format === 'jpeg') {
      ctx.fillStyle = isDarkMode ? '#141414' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    ctx.drawImage(img, 0, 0, exportWidth, exportHeight);
    
    const imgUrl = canvas.toDataURL(`image/${format}`, 1.0);
    const a = document.createElement('a');
    a.href = imgUrl;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
  };
  
  img.src = url;
};
