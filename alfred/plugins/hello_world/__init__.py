"""
Hello World Plugin - A simple example plugin for ALFRED
"""

from alfred_core import Plugin, PluginMetadata


class HelloWorldPlugin(Plugin):
    """A simple plugin that demonstrates the plugin system"""
    
    @property
    def metadata(self) -> PluginMetadata:
        return PluginMetadata(
            name="hello_world",
            version="1.0.0",
            author="ALFRED Team",
            description="A simple hello world plugin example",
            ui_support=["tkinter", "custom", "web"],
            dependencies=[],
            permissions=[]
        )
    
    def activate(self, app: 'AlfredCore') -> None:
        """Called when plugin is activated"""
        self._app = app
        
        # Register commands
        self.register_command(
            "hello",
            self.say_hello,
            "Say hello to the world"
        )
        
        self.register_command(
            "greet",
            self.greet_user,
            "Greet a specific user"
        )
        
        # Subscribe to events
        self.subscribe_event("chat.message.sent", self.on_message_sent)
        
        # Log activation
        app.event_bus.emit("plugin.hello_world.activated", {
            "message": "Hello World plugin activated!"
        })
    
    def deactivate(self) -> None:
        """Called when plugin is deactivated"""
        if self._app:
            self._app.event_bus.emit("plugin.hello_world.deactivated", {
                "message": "Goodbye from Hello World plugin!"
            })
    
    def say_hello(self) -> str:
        """Simple hello command"""
        return "Hello, World! 👋 This is the Hello World plugin!"
    
    def greet_user(self, name: str = "User") -> str:
        """Greet a specific user"""
        return f"Hello, {name}! Welcome to ALFRED!"
    
    def on_message_sent(self, event) -> None:
        """React to messages that contain 'hello'"""
        message = event.data.get("message", "").lower()
        if "hello" in message and self._app:
            # Emit a friendly response event
            self._app.event_bus.emit("plugin.hello_world.greeting_detected", {
                "original_message": event.data.get("message"),
                "response": "I see you said hello! 👋"
            })
    
    def get_settings_schema(self) -> dict:
        """Return settings schema for UI generation"""
        return {
            "greeting_style": {
                "type": "select",
                "label": "Greeting Style",
                "options": ["formal", "casual", "enthusiastic"],
                "default": "casual"
            },
            "auto_greet": {
                "type": "boolean",
                "label": "Auto-greet on activation",
                "default": True
            }
        }