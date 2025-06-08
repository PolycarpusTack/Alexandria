/**
 * Dummy sessions for Alfred dashboard
 */

// This function is attached to the window object to be accessed by the AlfredDashboard component
window.getAlfredSessions = function() {
  return [
    {
      id: "session-1",
      projectPath: "C:/Projects/Alexandria",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        model: "dummy-model",
        totalTokens: 0
      }
    }
  ];
};

// Similarly for creating a session
window.createAlfredSession = function(projectPath) {
  return {
    id: `session-${Date.now()}`,
    projectPath: projectPath || "C:/Projects/Alexandria",
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {
      model: "dummy-model",
      totalTokens: 0
    }
  };
};

console.log("Alfred session helpers loaded");
