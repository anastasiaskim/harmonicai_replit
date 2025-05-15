# Build Process for AI Audiobook Web App

This document describes the build and transpilation process for the text parsing components.

## Text Parser Build Process

The text parser component is a standalone module that can be used independently of the React application. It provides functionality for parsing and processing text files into chapters.

### Build Process

1. To build the text parser component, run:

   ```
   node build.js
   ```

   This will:
   - Transpile all TypeScript files using the parser.tsconfig.json configuration
   - Create a standalone bundled version of the parser in public/js/parser.js
   - Generate source maps for easier debugging

2. The output files will be:
   - `public/js/parser.js` - Bundled and minified parser for use in browsers
   - `public/js/parser.js.map` - Source map for the bundled parser
   - `public/js/client/src/lib/textParser.js` - Transpiled JavaScript version of the text parser

### Demo Page

A demo page for the text parser is available at `/parser-demo.html`. This page demonstrates the use of the parser component for detecting sections and chapters in text files.

### Using the Parser in HTML

To use the parser in a standalone HTML page:

```html
<script type="module" src="/js/parser.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', () => {
    // The parser functions are available via the global TextParser object
    const { readFile, parseSections, displaySections } = window.TextParser;
    
    // Use the parser functions as needed
  });
</script>
```

## Library Access

The parser module exports the following functions:

- `readFile(file)` - Reads a file and returns its content as text
- `parseSections(text, patterns)` - Parses text into sections based on patterns
- `formatSectionContent(content)` - Formats section content into a string
- `displaySections(sections, outputElement)` - Displays sections in a DOM element
- `initializeFileParser(fileInputId, outputElementId, patternString)` - Sets up event handlers for file parsing

## Integration with Main App

The text parser is also integrated with the main React application and used for automatic chapter detection and manual chapter splitting in the Audiobook Web App.