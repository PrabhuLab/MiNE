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
      // Remove color pickers only after original and cloned nodes have been
      // matched; removing them earlier shifts every subsequent style mapping.
      legendClone.querySelectorAll('input[type="color"]').forEach((input) => input.remove());
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

export const viewportRasterDimensions = (width: number, height: number, pixelRatio: number) => {
  const viewportWidth = Math.max(1, Math.round(width));
  const viewportHeight = Math.max(1, Math.round(height));
  const scale = Math.max(10, pixelRatio || 1);
  return {
    viewportWidth,
    viewportHeight,
    exportWidth: Math.round(viewportWidth * scale),
    exportHeight: Math.round(viewportHeight * scale),
  };
};

export const exportImage = async (svgElement: SVGSVGElement | null, format: 'png' | 'jpeg', filename: string, isDarkMode: boolean = false) => {
  if (!svgElement) throw new Error('The graph viewport is not available.');

  const bounds = svgElement.getBoundingClientRect();
  const { viewportWidth, viewportHeight, exportWidth, exportHeight } = viewportRasterDimensions(
    bounds.width || svgElement.clientWidth,
    bounds.height || svgElement.clientHeight,
    window.devicePixelRatio || 1,
  );
  const clone = svgElement.cloneNode(true) as SVGSVGElement;

  // Keep the zoom group's current transform and rasterize the exact visible
  // SVG viewport. Output resolution is increased without changing framing.
  clone.setAttribute('viewBox', `0 0 ${viewportWidth} ${viewportHeight}`);
  clone.setAttribute('width', `${exportWidth}`);
  clone.setAttribute('height', `${exportHeight}`);

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
  
  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('The graph SVG could not be rendered.'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('A canvas could not be created for the graph export.');

    ctx.fillStyle = isDarkMode ? '#141414' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, exportWidth, exportHeight);

    const blob = await new Promise<Blob | null>((resolve, reject) => {
      try {
        canvas.toBlob(resolve, `image/${format}`, 1);
      } catch (error) {
        reject(error);
      }
    });
    if (!blob) throw new Error(`The graph could not be encoded as ${format.toUpperCase()}.`);
    downloadBlobAsFile(blob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
};
