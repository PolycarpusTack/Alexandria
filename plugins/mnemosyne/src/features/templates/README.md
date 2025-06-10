# Mnemosyne Plugin - Templates & Snippets Feature

## Overview
The Templates & Snippets system is a core feature of Mnemosyne, Alexandria's knowledge management and documentation plugin. It provides intelligent template management, snippet organization, and AI-powered document generation within the broader Mnemosyne ecosystem.

## Architecture within Mnemosyne

```
mnemosyne/
├── src/
│   ├── core/
│   │   ├── MnemosyneCore.ts           # Main plugin core
│   │   ├── KnowledgeGraph.ts          # Knowledge relationships
│   │   └── DocumentManager.ts         # Document handling
│   ├── features/
│   │   ├── templates/                 # Template system
│   │   │   ├── TemplateEngine.ts      # Template rendering
│   │   │   ├── TemplateRepository.ts  # Template storage
│   │   │   ├── SnippetManager.ts      # Snippet handling
│   │   │   └── AITemplateGenerator.ts # ALFRED integration
│   │   ├── search/                    # Knowledge search
│   │   ├── versioning/                # Document versioning
│   │   └── collaboration/             # Team features
│   └── ui/
│       ├── MnemosyneExplorer.tsx      # Main explorer
│       ├── TemplateGallery.tsx        # Template browser
│       └── SnippetPalette.tsx         # Quick snippets
├── knowledge-base/
│   ├── templates/                     # Template library
│   │   ├── documentation/
│   │   ├── meeting-notes/
│   │   ├── technical-specs/
│   │   └── project-planning/
│   ├── snippets/                      # Snippet library
│   └── schemas/                       # Document schemas
└── mnemosyne.config.json
```

## Integration with Mnemosyne Features

### 1. Knowledge Graph Integration
Templates are nodes in Mnemosyne's knowledge graph, creating relationships between:
- Template usage patterns
- Document lineage
- Related knowledge articles
- Team collaboration patterns

### 2. Smart Context from Mnemosyne
```typescript
interface MnemosyneTemplateContext {
  // Core Mnemosyne context
  knowledgeBase: {
    relatedDocuments: Document[];
    recentlyViewed: Document[];
    frequentlyUsed: Template[];
  };
  
  // User's knowledge profile
  userProfile: {
    expertise: string[];
    preferences: TemplatePreferences;
    history: TemplateHistory;
  };
  
  // Project context
  projectContext: {
    activeProject: Project;
    teamMembers: User[];
    projectTemplates: Template[];
  };
  
  // Alexandria platform context
  alexandria: {
    alfredAvailable: boolean;
    crashAnalyzerData?: any;
    heimdallMetrics?: any;
  };
}
```

### 3. Template Lifecycle in Mnemosyne

```typescript
class MnemosyneTemplateEngine {
  // Template discovery
  async discoverTemplates(context: SearchContext): Promise<Template[]> {
    // Search across knowledge base
    const kbTemplates = await this.knowledgeBase.search(context);
    
    // Get AI recommendations
    const aiSuggestions = await this.alfred.suggestTemplates(context);
    
    // Combine with usage patterns
    return this.rankByRelevance([...kbTemplates, ...aiSuggestions]);
  }
  
  // Template evolution
  async evolveTemplate(template: Template, usage: UsageData): Promise<Template> {
    // Learn from usage patterns
    const patterns = await this.analyzer.extractPatterns(usage);
    
    // Optimize with AI
    const optimized = await this.alfred.optimizeTemplate(template, patterns);
    
    // Version in knowledge graph
    return this.knowledgeGraph.version(optimized);
  }
}
```

## Mnemosyne-Specific Templates

### Documentation Templates
**Location**: `knowledge-base/templates/documentation/`

```handlebars
<!-- knowledge-base/templates/documentation/knowledge-article.hbs -->
# {{title}}

**Knowledge ID**: {{mnemosyne.id}}  
**Created**: {{mnemosyne.created}}  
**Last Updated**: {{mnemosyne.updated}}  
**Author**: {{author.name}}  
**Tags**: {{#each tags}}#{{this}} {{/each}}

## Summary
{{summary}}

## Content
{{content}}

## Related Knowledge
{{#each mnemosyne.related}}
- [{{this.title}}]({{this.link}}) - {{this.relevance}}% relevant
{{/each}}

## Version History
{{#each mnemosyne.versions}}
- **v{{this.version}}** ({{this.date}}): {{this.changes}}
{{/each}}

---
*Managed by Mnemosyne v{{mnemosyne.version}} | Alexandria Platform*
```

### Meeting Intelligence Templates
```handlebars
<!-- knowledge-base/templates/meeting-notes/intelligent-meeting.hbs -->
# {{meeting.title}}

**Date**: {{meeting.date}}  
**Participants**: {{#each participants}}{{name}} {{/each}}  
**Mnemosyne Ref**: {{mnemosyne.reference}}

## AI-Generated Summary
{{#if alfred.summary}}
{{alfred.summary}}
{{else}}
*Generating summary with ALFRED...*
{{/if}}

## Key Decisions
{{#each decisions}}
- **{{this.decision}}**
  - Context: {{this.context}}
  - Impact: {{this.impact}}
  - Owner: {{this.owner}}
{{/each}}

## Action Items
{{#each actions}}
- [ ] {{this.task}} - @{{this.assignee}} by {{this.due}}
  - Related Docs: {{#each this.relatedDocs}}[{{title}}]({{link}}) {{/each}}
{{/each}}

## Knowledge Graph Connections
{{#each mnemosyne.connections}}
- {{this.type}}: [{{this.title}}]({{this.link}})
{{/each}}
```

### Technical Documentation Templates
```handlebars
<!-- knowledge-base/templates/technical-specs/api-documentation.hbs -->
# {{api.name}} API Documentation

**Version**: {{api.version}}  
**Mnemosyne ID**: {{mnemosyne.id}}  
**Knowledge Links**: {{mnemosyne.linkedCount}} documents

## Overview
{{api.description}}

## Endpoints
{{#each endpoints}}
### {{method}} {{path}}
{{description}}

**Parameters**:
{{#each parameters}}
- `{{name}}` ({{type}}): {{description}}
{{/each}}

**Response**:
```json
{{responseExample}}
```

**Related Knowledge**:
{{#each mnemosyne.relatedEndpoints}}
- [{{this.title}}]({{this.link}})
{{/each}}
{{/each}}

## Code Examples
{{#if alfred.examples}}
<!-- Generated by ALFRED -->
{{alfred.examples}}
{{else}}
<button onclick="generateExamples()">Generate with ALFRED</button>
{{/if}}
```

## Snippet Integration

### Mnemosyne Smart Snippets
```json
{
  "mnemosyne-snippets": {
    "knowledge-link": {
      "prefix": "mkl",
      "body": "[[${1:KnowledgeTitle}|mnemosyne:${2:id}]]",
      "description": "Create Mnemosyne knowledge link"
    },
    
    "knowledge-query": {
      "prefix": "mkq",
      "body": [
        "```mnemosyne-query",
        "SELECT * FROM knowledge_base",
        "WHERE tags CONTAINS '${1:tag}'",
        "AND created > '${2:date}'",
        "ORDER BY relevance DESC",
        "```"
      ],
      "description": "Query Mnemosyne knowledge base"
    },
    
    "template-var": {
      "prefix": "mtv",
      "body": "{{mnemosyne.${1|id,version,author,related,tags|}}}",
      "description": "Insert Mnemosyne template variable"
    }
  }
}
```

## UI Integration within Mnemosyne

### Template Gallery Component
```typescript
export const MnemosyneTemplateGallery: React.FC = () => {
  const { knowledgeBase, activeDocument } = useMnemosyne();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filter, setFilter] = useState<TemplateFilter>({
    category: 'all',
    tags: [],
    author: null,
    usageFrequency: 'any'
  });

  useEffect(() => {
    // Load templates with Mnemosyne context
    const loadTemplates = async () => {
      const contextualTemplates = await knowledgeBase.getTemplates({
        context: activeDocument,
        filter,
        includeAISuggestions: true
      });
      setTemplates(contextualTemplates);
    };
    loadTemplates();
  }, [filter, activeDocument]);

  return (
    <div className="mnemosyne-template-gallery">
      <TemplateSearch onFilterChange={setFilter} />
      <TemplateGrid 
        templates={templates}
        onSelect={handleTemplateSelect}
        showKnowledgeConnections={true}
      />
    </div>
  );
};
```

## Mnemosyne-Specific Features

### 1. Template Intelligence
```typescript
class MnemosyneTemplateIntelligence {
  async suggestTemplate(context: DocumentContext): Promise<Template[]> {
    // Analyze current document
    const docAnalysis = await this.analyzeDocument(context.document);
    
    // Find similar documents in knowledge base
    const similarDocs = await this.knowledgeGraph.findSimilar(docAnalysis);
    
    // Extract successful patterns
    const patterns = similarDocs
      .map(doc => doc.templateUsed)
      .filter(Boolean);
    
    // Get AI recommendations
    if (this.alfred.isAvailable()) {
      const aiTemplates = await this.alfred.recommendTemplates({
        documentType: docAnalysis.type,
        similarPatterns: patterns,
        userPreferences: context.user.preferences
      });
      patterns.push(...aiTemplates);
    }
    
    return this.rankTemplates(patterns, context);
  }
}
```

### 2. Knowledge Graph Templates
Templates that leverage Mnemosyne's knowledge relationships:

```handlebars
<!-- knowledge-base/templates/knowledge-graph/concept-map.hbs -->
# {{concept.name}} - Concept Map

## Definition
{{concept.definition}}

## Relationships
{{#each mnemosyne.graph.relationships}}
### {{this.type}}
{{#each this.nodes}}
- [{{this.title}}](mnemosyne://{{this.id}}) 
  - Strength: {{this.strength}}%
  - Type: {{this.relationType}}
{{/each}}
{{/each}}

## Visual Graph
```mnemosyne-graph
center: {{concept.id}}
depth: {{graphDepth}}
layout: {{graphLayout}}
```

## Learning Path
{{#if mnemosyne.learningPath}}
{{#each mnemosyne.learningPath.steps}}
{{@index}}. [{{this.title}}]({{this.link}}) - {{this.estimatedTime}}
{{/each}}
{{/if}}
```

### 3. Collaborative Templates
```handlebars
<!-- knowledge-base/templates/collaboration/team-knowledge.hbs -->
# {{title}} - Team Knowledge Document

**Team**: {{team.name}}  
**Contributors**: {{#each contributors}}@{{this.username}} {{/each}}  
**Mnemosyne Collaborative ID**: {{mnemosyne.collabId}}

## Shared Understanding
{{sharedContext}}

## Individual Contributions
{{#each contributions}}
### @{{this.author}} - {{this.timestamp}}
{{this.content}}

**Knowledge Links**: 
{{#each this.knowledgeLinks}}
- [{{this.title}}]({{this.link}})
{{/each}}
{{/each}}

## Consensus Items
{{#each consensus}}
- {{this.item}} (Agreement: {{this.agreementLevel}}%)
{{/each}}

## Open Questions
{{#each questions}}
- {{this.question}} - Asked by @{{this.author}}
  {{#if this.answers}}
  **Answers**:
  {{#each this.answers}}
  - @{{this.author}}: {{this.answer}}
  {{/each}}
  {{/if}}
{{/each}}
```

## Configuration within Mnemosyne

```json
{
  "mnemosyne": {
    "features": {
      "templates": {
        "enabled": true,
        "defaultEngine": "handlebars",
        "autoSuggest": true,
        "aiIntegration": {
          "alfred": true,
          "autoGenerate": true,
          "learnFromUsage": true
        },
        "knowledgeGraphIntegration": {
          "linkTemplates": true,
          "suggestByContext": true,
          "trackLineage": true
        }
      }
    },
    "templateSettings": {
      "categories": [
        "documentation",
        "meeting-notes",
        "technical-specs",
        "project-planning",
        "knowledge-graphs",
        "collaboration"
      ],
      "versionControl": {
        "enabled": true,
        "provider": "git",
        "autoCommit": true
      }
    }
  }
}
```

## Benefits of Mnemosyne Integration

1. **Contextual Intelligence**: Templates understand their place in the knowledge graph
2. **Evolution**: Templates improve based on usage patterns across the knowledge base
3. **Discovery**: Find templates through knowledge relationships, not just search
4. **Collaboration**: Templates facilitate team knowledge sharing
5. **AI Enhancement**: ALFRED understands Mnemosyne's context for better generation

This design makes templates a natural part of Mnemosyne's knowledge management system rather than a separate feature, creating a more cohesive and intelligent documentation experience.