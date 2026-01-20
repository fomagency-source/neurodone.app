// ============================================
// NEURODONE - Intelligent Hybrid Parsing System
// ============================================
// 
// Architecture:
// 1. Local Parser (handles 60-70% of inputs) - FREE
// 2. Pattern Learning (improves over time) - FREE  
// 3. Claude API (complex cases only) - PAID
//
// Cost Target: Claude used only 30-40% of time
// ============================================

class NeurodoneAI {
  constructor(config = {}) {
    // Configuration
    this.config = {
      apiEndpoint: config.apiEndpoint || '/api/parse',
      maxFreeCallsPerDay: config.maxFreeCallsPerDay || 5,
      maxPaidCallsPerDay: config.maxPaidCallsPerDay || 50,
      voiceLengthThresholdSeconds: config.voiceLengthThresholdSeconds || 15,
      minConfidenceForLocal: config.minConfidenceForLocal || 0.75,
      ...config
    };

    // Load learned patterns from localStorage
    this.learnedPatterns = this.loadLearnedPatterns();
    this.userProjects = this.loadUserProjects();
    this.userStats = this.loadUserStats();
    
    // Track API usage
    this.apiCallsToday = this.getApiCallsToday();
  }

  // ============================================
  // MAIN ENTRY POINT
  // ============================================
  
  async parseTask(input, options = {}) {
    const {
      voiceDurationSeconds = 0,
      forceCloud = false,
      isCoachMode = false
    } = options;

    // Track for analytics
    this.userStats.totalInputs = (this.userStats.totalInputs || 0) + 1;

    // Decision: Local or Cloud?
    const decision = this.decideParsingStrategy(input, voiceDurationSeconds, forceCloud, isCoachMode);
    
    console.log(`[NeurodoneAI] Strategy: ${decision.strategy}, Confidence: ${decision.confidence}, Reason: ${decision.reason}`);

    let result;
    
    if (decision.strategy === 'local') {
      result = await this.parseLocally(input);
      result._parsedBy = 'local';
      result._confidence = decision.confidence;
      
      // Track local success
      this.userStats.localParses = (this.userStats.localParses || 0) + 1;
    } else {
      // Check rate limits
      if (!this.canMakeApiCall()) {
        console.log('[NeurodoneAI] Rate limit reached, falling back to local');
        result = await this.parseLocally(input);
        result._parsedBy = 'local_fallback';
        result._rateLimited = true;
      } else {
        result = await this.parseWithClaude(input, isCoachMode);
        result._parsedBy = 'claude';
        
        // LEARN from Claude's response
        this.learnFromClaudeResponse(input, result);
        
        // Track API usage
        this.incrementApiCalls();
        this.userStats.cloudParses = (this.userStats.cloudParses || 0) + 1;
      }
    }

    // Save stats
    this.saveUserStats();
    
    return result;
  }

  // ============================================
  // DECISION ENGINE
  // ============================================

  decideParsingStrategy(input, voiceDurationSeconds, forceCloud, isCoachMode) {
    // Force cloud for coach mode (conversations)
    if (isCoachMode) {
      return { strategy: 'cloud', confidence: 0, reason: 'coach_mode' };
    }

    // Force cloud if explicitly requested
    if (forceCloud) {
      return { strategy: 'cloud', confidence: 0, reason: 'forced' };
    }

    // Long voice input (>15 sec) = likely brain dump = needs Claude
    if (voiceDurationSeconds > this.config.voiceLengthThresholdSeconds) {
      return { strategy: 'cloud', confidence: 0, reason: 'long_voice_input' };
    }

    // Check if input matches learned patterns
    const patternMatch = this.findMatchingPattern(input);
    if (patternMatch && patternMatch.confidence >= this.config.minConfidenceForLocal) {
      return { strategy: 'local', confidence: patternMatch.confidence, reason: 'learned_pattern' };
    }

    // Check local parser confidence
    const localConfidence = this.estimateLocalConfidence(input);
    if (localConfidence >= this.config.minConfidenceForLocal) {
      return { strategy: 'local', confidence: localConfidence, reason: 'high_local_confidence' };
    }

    // Multiple tasks detected = needs Claude
    if (this.detectsMultipleTasks(input)) {
      return { strategy: 'cloud', confidence: localConfidence, reason: 'multiple_tasks' };
    }

    // Ambiguous input = needs Claude
    if (this.isAmbiguous(input)) {
      return { strategy: 'cloud', confidence: localConfidence, reason: 'ambiguous' };
    }

    // Default to local for simple inputs
    if (input.split(' ').length < 10) {
      return { strategy: 'local', confidence: 0.6, reason: 'short_simple_input' };
    }

    // When in doubt, use cloud (but this should be rare)
    return { strategy: 'cloud', confidence: localConfidence, reason: 'uncertain' };
  }

  estimateLocalConfidence(input) {
    let confidence = 0.5; // Base confidence
    const text = input.toLowerCase();

    // Boost confidence for clear patterns
    const clearPatterns = [
      /^(finish|complete|do|make|create|write|send|call|email|buy|get|fix|update|review)/i,
      /(by|until|before|tomorrow|today|monday|tuesday|wednesday|thursday|friday|next week)/i,
      /(for|project|client|team|work|meeting)/i
    ];

    clearPatterns.forEach(pattern => {
      if (pattern.test(text)) confidence += 0.1;
    });

    // Boost if project name matches known projects
    const knownProject = this.findKnownProject(text);
    if (knownProject) confidence += 0.15;

    // Reduce confidence for complex inputs
    if (text.includes(' and ') && text.includes(' then ')) confidence -= 0.2;
    if (text.split(' ').length > 20) confidence -= 0.15;
    if ((text.match(/,/g) || []).length > 3) confidence -= 0.1;

    return Math.max(0, Math.min(1, confidence));
  }

  detectsMultipleTasks(input) {
    const text = input.toLowerCase();
    const multiTaskIndicators = [
      /\b(first|then|after that|also|and then|next|finally)\b/g,
      /\d+\)\s/g, // Numbered lists
      /•|-\s/g,   // Bullet points
    ];

    let score = 0;
    multiTaskIndicators.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) score += matches.length;
    });

    // Multiple "and" with verbs suggests multiple tasks
    const andCount = (text.match(/\band\b/g) || []).length;
    const verbCount = (text.match(/\b(finish|complete|do|make|create|write|send|call|email|buy|get|fix|update|review|prepare|schedule)\b/g) || []).length;
    
    if (andCount >= 2 && verbCount >= 2) score += 2;

    return score >= 2;
  }

  isAmbiguous(input) {
    const text = input.toLowerCase();
    
    // Vague inputs
    const vaguePatterns = [
      /^(something|stuff|things?|that thing)\b/,
      /\b(maybe|probably|might|could|not sure|i think)\b/,
      /\?\s*$/,  // Questions
    ];

    return vaguePatterns.some(pattern => pattern.test(text));
  }

  // ============================================
  // LOCAL PARSER (Self-Improving)
  // ============================================

  async parseLocally(input) {
    const text = input.trim();
    
    // Try learned patterns first
    const patternResult = this.applyLearnedPatterns(text);
    if (patternResult) {
      return this.formatTaskResult(patternResult);
    }

    // Fall back to rule-based parsing
    return this.ruleBasedParse(text);
  }

  ruleBasedParse(text) {
    const lowerText = text.toLowerCase();
    
    // Extract task name (clean version)
    let taskName = text
      .replace(/\b(for|by|until|before|tomorrow|today|next week|on monday|on tuesday|on wednesday|on thursday|on friday|on saturday|on sunday)\b.*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Capitalize first letter
    taskName = taskName.charAt(0).toUpperCase() + taskName.slice(1);
    if (!taskName) taskName = text.charAt(0).toUpperCase() + text.slice(1);

    // Extract project
    let project = 'Inbox';
    const projectPatterns = [
      /\bfor\s+(?:the\s+)?([A-Z][a-zA-Z0-9\s]+?)(?:\s+by|\s+until|\s+before|\s+tomorrow|\s+today|\s+next|\s+on\s+|$)/i,
      /\b(?:project|client|team)[\s:]+([A-Z][a-zA-Z0-9\s]+?)(?:\s+by|\s+until|\s+before|\s+tomorrow|\s+today|\s+next|\s+on\s+|$)/i,
    ];

    for (const pattern of projectPatterns) {
      const match = text.match(pattern);
      if (match) {
        project = match[1].trim();
        // Check if it's a known project
        const knownProject = this.findKnownProject(project);
        if (knownProject) project = knownProject;
        break;
      }
    }

    // Extract deadline
    const deadline = this.extractDeadline(lowerText);

    // Generate chunks based on task type
    const chunks = this.generateChunks(taskName);

    // Learn this project for future
    if (project !== 'Inbox') {
      this.learnProject(project);
    }

    return this.formatTaskResult({ taskName, project, deadline, chunks });
  }

  extractDeadline(text) {
    const now = new Date();
    let deadline = new Date(now);
    deadline.setDate(deadline.getDate() + 1); // Default: tomorrow

    const deadlinePatterns = [
      { pattern: /\btoday\b/, days: 0 },
      { pattern: /\btomorrow\b/, days: 1 },
      { pattern: /\bday after tomorrow\b/, days: 2 },
      { pattern: /\bnext week\b/, days: 7 },
      { pattern: /\bin (\d+) days?\b/, handler: (m) => parseInt(m[1]) },
      { pattern: /\bin (\d+) weeks?\b/, handler: (m) => parseInt(m[1]) * 7 },
      { pattern: /\bon monday\b/, weekday: 1 },
      { pattern: /\bon tuesday\b/, weekday: 2 },
      { pattern: /\bon wednesday\b/, weekday: 3 },
      { pattern: /\bon thursday\b/, weekday: 4 },
      { pattern: /\bon friday\b/, weekday: 5 },
      { pattern: /\bon saturday\b/, weekday: 6 },
      { pattern: /\bon sunday\b/, weekday: 0 },
      { pattern: /\bmonday\b/, weekday: 1 },
      { pattern: /\btuesday\b/, weekday: 2 },
      { pattern: /\bwednesday\b/, weekday: 3 },
      { pattern: /\bthursday\b/, weekday: 4 },
      { pattern: /\bfriday\b/, weekday: 5 },
    ];

    for (const dp of deadlinePatterns) {
      const match = text.match(dp.pattern);
      if (match) {
        if (dp.days !== undefined) {
          deadline.setDate(now.getDate() + dp.days);
        } else if (dp.handler) {
          deadline.setDate(now.getDate() + dp.handler(match));
        } else if (dp.weekday !== undefined) {
          const currentDay = now.getDay();
          let daysUntil = dp.weekday - currentDay;
          if (daysUntil <= 0) daysUntil += 7;
          deadline.setDate(now.getDate() + daysUntil);
        }
        break;
      }
    }

    // Try to extract specific date (e.g., "January 25", "25th", "1/25")
    const dateMatch = text.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
    if (dateMatch) {
      const month = parseInt(dateMatch[1]) - 1;
      const day = parseInt(dateMatch[2]);
      const year = dateMatch[3] ? parseInt(dateMatch[3]) : now.getFullYear();
      deadline = new Date(year, month, day);
    }

    return deadline.toISOString();
  }

  generateChunks(taskName) {
    const name = taskName.toLowerCase();
    let chunkTemplates = [];

    // Match task type to chunk template
    const taskTypes = [
      {
        patterns: [/presentation|deck|slides|pitch/],
        chunks: ['Research & gather info', 'Create outline', 'Design slides', 'Add content', 'Review & polish']
      },
      {
        patterns: [/report|document|write|article|blog/],
        chunks: ['Outline structure', 'Write first draft', 'Review & edit', 'Final polish']
      },
      {
        patterns: [/email|message|reply|respond/],
        chunks: ['Draft message', 'Review tone', 'Send']
      },
      {
        patterns: [/meeting|call|interview/],
        chunks: ['Prepare agenda', 'Gather materials', 'Attend', 'Follow up notes']
      },
      {
        patterns: [/design|create|make|build/],
        chunks: ['Research inspiration', 'Sketch concepts', 'Create draft', 'Refine details']
      },
      {
        patterns: [/review|analyze|audit/],
        chunks: ['Gather materials', 'Initial review', 'Deep analysis', 'Write findings']
      },
      {
        patterns: [/plan|strategy|roadmap/],
        chunks: ['Research & context', 'Brainstorm options', 'Draft plan', 'Review & finalize']
      },
      {
        patterns: [/fix|debug|solve|repair/],
        chunks: ['Identify issue', 'Research solution', 'Implement fix', 'Test & verify']
      },
      {
        patterns: [/learn|study|course|read/],
        chunks: ['Set up environment', 'First session', 'Practice', 'Review notes']
      },
      {
        patterns: [/buy|purchase|order|shop/],
        chunks: ['Research options', 'Compare prices', 'Make purchase']
      },
    ];

    for (const type of taskTypes) {
      if (type.patterns.some(p => p.test(name))) {
        chunkTemplates = type.chunks;
        break;
      }
    }

    // Default chunks
    if (chunkTemplates.length === 0) {
      chunkTemplates = ['Start task', 'Main work', 'Finish up'];
    }

    // Check learned chunks for this task pattern
    const learnedChunks = this.getLearnedChunksForTask(name);
    if (learnedChunks && learnedChunks.length > 0) {
      chunkTemplates = learnedChunks;
    }

    return chunkTemplates.map((name, i) => ({
      id: this.generateId(),
      name,
      completed: false,
      order: i
    }));
  }

  // ============================================
  // PATTERN LEARNING SYSTEM
  // ============================================

  findMatchingPattern(input) {
    const normalized = this.normalizeForMatching(input);
    
    for (const pattern of this.learnedPatterns) {
      if (this.patternsMatch(normalized, pattern.normalized)) {
        return {
          pattern,
          confidence: pattern.successRate || 0.8
        };
      }
    }
    return null;
  }

  applyLearnedPatterns(input) {
    const match = this.findMatchingPattern(input);
    if (!match) return null;

    const pattern = match.pattern;
    
    // Apply the learned pattern
    return {
      taskName: this.applyPatternTemplate(input, pattern.taskNameTemplate),
      project: this.extractWithPattern(input, pattern.projectPattern) || pattern.defaultProject || 'Inbox',
      deadline: this.extractDeadline(input.toLowerCase()),
      chunks: pattern.chunks || this.generateChunks(input)
    };
  }

  learnFromClaudeResponse(input, claudeResult) {
    // Extract pattern from successful Claude parse
    const normalized = this.normalizeForMatching(input);
    
    const pattern = {
      id: this.generateId(),
      normalized,
      originalInput: input,
      taskNameTemplate: this.createTaskNameTemplate(input, claudeResult.name),
      projectPattern: this.createProjectPattern(input, claudeResult.project),
      defaultProject: claudeResult.project,
      chunks: claudeResult.chunks?.map(c => c.name) || [],
      createdAt: new Date().toISOString(),
      useCount: 1,
      successRate: 1.0
    };

    // Add to learned patterns (avoid duplicates)
    const existingIndex = this.learnedPatterns.findIndex(p => 
      this.patternsMatch(p.normalized, normalized)
    );

    if (existingIndex >= 0) {
      // Update existing pattern
      this.learnedPatterns[existingIndex].useCount++;
      this.learnedPatterns[existingIndex].chunks = pattern.chunks;
    } else {
      // Add new pattern
      this.learnedPatterns.push(pattern);
    }

    // Keep only last 100 patterns (memory management)
    if (this.learnedPatterns.length > 100) {
      this.learnedPatterns = this.learnedPatterns
        .sort((a, b) => b.useCount - a.useCount)
        .slice(0, 100);
    }

    this.saveLearnedPatterns();
    console.log(`[NeurodoneAI] Learned new pattern. Total patterns: ${this.learnedPatterns.length}`);
  }

  normalizeForMatching(input) {
    return input
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\b(the|a|an|to|for|by|on|at|in)\b/g, '')
      .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g, '[DAY]')
      .replace(/\b(today|tomorrow|next week)\b/g, '[TIME]')
      .replace(/\b\d+\b/g, '[NUM]')
      .replace(/\s+/g, ' ')
      .trim();
  }

  patternsMatch(a, b) {
    // Fuzzy matching - allow 80% similarity
    const wordsA = a.split(' ');
    const wordsB = b.split(' ');
    
    let matches = 0;
    for (const word of wordsA) {
      if (wordsB.includes(word)) matches++;
    }

    const similarity = matches / Math.max(wordsA.length, wordsB.length);
    return similarity >= 0.7;
  }

  createTaskNameTemplate(input, resultName) {
    // Simple template: just store the transformation
    return { original: input, result: resultName };
  }

  createProjectPattern(input, project) {
    const lowerInput = input.toLowerCase();
    const lowerProject = project.toLowerCase();
    
    // Find where project name appears in input
    const index = lowerInput.indexOf(lowerProject);
    if (index >= 0) {
      // Find the pattern before project name
      const before = lowerInput.substring(Math.max(0, index - 10), index).trim();
      return { keyword: before, project };
    }
    return null;
  }

  applyPatternTemplate(input, template) {
    if (!template) return input.charAt(0).toUpperCase() + input.slice(1);
    // For now, simple capitalization - can be enhanced
    return input.charAt(0).toUpperCase() + input.slice(1);
  }

  extractWithPattern(input, pattern) {
    if (!pattern) return null;
    const lowerInput = input.toLowerCase();
    
    if (pattern.keyword) {
      const index = lowerInput.indexOf(pattern.keyword);
      if (index >= 0) {
        // Extract word after keyword
        const after = input.substring(index + pattern.keyword.length).trim();
        const words = after.split(/\s+/);
        if (words.length > 0) {
          return words[0].charAt(0).toUpperCase() + words[0].slice(1);
        }
      }
    }
    return null;
  }

  // ============================================
  // PROJECT LEARNING
  // ============================================

  learnProject(projectName) {
    const normalized = projectName.toLowerCase().trim();
    
    if (!this.userProjects.some(p => p.normalized === normalized)) {
      this.userProjects.push({
        name: projectName,
        normalized,
        usageCount: 1,
        createdAt: new Date().toISOString()
      });
      this.saveUserProjects();
    } else {
      const project = this.userProjects.find(p => p.normalized === normalized);
      if (project) project.usageCount++;
      this.saveUserProjects();
    }
  }

  findKnownProject(text) {
    const lowerText = text.toLowerCase();
    
    for (const project of this.userProjects) {
      if (lowerText.includes(project.normalized)) {
        return project.name; // Return properly capitalized version
      }
    }
    return null;
  }

  getLearnedChunksForTask(taskName) {
    // Find similar tasks in learned patterns and return their chunks
    const normalized = this.normalizeForMatching(taskName);
    
    for (const pattern of this.learnedPatterns) {
      if (this.patternsMatch(normalized, pattern.normalized) && pattern.chunks?.length > 0) {
        return pattern.chunks;
      }
    }
    return null;
  }

  // ============================================
  // CLAUDE API INTEGRATION
  // ============================================

  async parseWithClaude(input, isCoachMode = false) {
    try {
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input,
          mode: isCoachMode ? 'coach' : 'parse',
          userProjects: this.userProjects.map(p => p.name),
          context: {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            currentDate: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      return this.formatTaskResult(result);
      
    } catch (error) {
      console.error('[NeurodoneAI] Claude API error:', error);
      // Fallback to local parsing
      return this.ruleBasedParse(input);
    }
  }

  // ============================================
  // RATE LIMITING
  // ============================================

  canMakeApiCall() {
    const isPaidUser = this.config.isPaidUser || false;
    const limit = isPaidUser ? this.config.maxPaidCallsPerDay : this.config.maxFreeCallsPerDay;
    return this.apiCallsToday < limit;
  }

  getApiCallsToday() {
    const stored = localStorage.getItem('neurodone_api_calls');
    if (!stored) return 0;
    
    const data = JSON.parse(stored);
    const today = new Date().toDateString();
    
    if (data.date !== today) {
      return 0; // Reset for new day
    }
    return data.count || 0;
  }

  incrementApiCalls() {
    const today = new Date().toDateString();
    this.apiCallsToday++;
    
    localStorage.setItem('neurodone_api_calls', JSON.stringify({
      date: today,
      count: this.apiCallsToday
    }));
  }

  getRemainingApiCalls() {
    const isPaidUser = this.config.isPaidUser || false;
    const limit = isPaidUser ? this.config.maxPaidCallsPerDay : this.config.maxFreeCallsPerDay;
    return Math.max(0, limit - this.apiCallsToday);
  }

  // ============================================
  // STORAGE HELPERS
  // ============================================

  loadLearnedPatterns() {
    try {
      const stored = localStorage.getItem('neurodone_patterns');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  saveLearnedPatterns() {
    localStorage.setItem('neurodone_patterns', JSON.stringify(this.learnedPatterns));
  }

  loadUserProjects() {
    try {
      const stored = localStorage.getItem('neurodone_projects');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  saveUserProjects() {
    localStorage.setItem('neurodone_projects', JSON.stringify(this.userProjects));
  }

  loadUserStats() {
    try {
      const stored = localStorage.getItem('neurodone_ai_stats');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  saveUserStats() {
    localStorage.setItem('neurodone_ai_stats', JSON.stringify(this.userStats));
  }

  // ============================================
  // UTILITIES
  // ============================================

  formatTaskResult(data) {
    return {
      id: this.generateId(),
      name: data.taskName || data.name || 'Untitled Task',
      project: data.project || 'Inbox',
      deadline: data.deadline || new Date(Date.now() + 86400000).toISOString(),
      chunks: data.chunks || this.generateChunks(data.taskName || data.name || ''),
      completed: false,
      createdAt: new Date().toISOString()
    };
  }

  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  // ============================================
  // ANALYTICS & INSIGHTS
  // ============================================

  getStats() {
    const total = (this.userStats.localParses || 0) + (this.userStats.cloudParses || 0);
    const localPercent = total > 0 ? ((this.userStats.localParses || 0) / total * 100).toFixed(1) : 0;
    
    return {
      totalInputs: this.userStats.totalInputs || 0,
      localParses: this.userStats.localParses || 0,
      cloudParses: this.userStats.cloudParses || 0,
      localPercent: `${localPercent}%`,
      learnedPatterns: this.learnedPatterns.length,
      knownProjects: this.userProjects.length,
      apiCallsToday: this.apiCallsToday,
      apiCallsRemaining: this.getRemainingApiCalls()
    };
  }

  // Export patterns for backup
  exportPatterns() {
    return {
      patterns: this.learnedPatterns,
      projects: this.userProjects,
      exportedAt: new Date().toISOString()
    };
  }

  // Import patterns from backup
  importPatterns(data) {
    if (data.patterns) {
      this.learnedPatterns = [...this.learnedPatterns, ...data.patterns];
      this.saveLearnedPatterns();
    }
    if (data.projects) {
      data.projects.forEach(p => this.learnProject(p.name));
    }
  }
}

// ============================================
// EXPORT FOR USE IN APP
// ============================================

// Browser global
if (typeof window !== 'undefined') {
  window.NeurodoneAI = NeurodoneAI;
}

// ES Module export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NeurodoneAI;
}
