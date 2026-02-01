# Extension Settings

Configure ClawFi to match your trading preferences.

## Accessing Settings

### Quick Settings
Click the ClawFi icon in your browser toolbar to access quick toggles.

### Full Settings
1. Right-click the ClawFi icon
2. Select "Options" or "Settings"
3. Or navigate to `chrome://extensions` → ClawFi → Details → Extension options

## General Settings

### Display Options

| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| Theme | Auto / Light / Dark | Auto | UI color scheme |
| Position | Bottom Right / Bottom Left / Top Right / Top Left | Bottom Right | FAB placement |
| Auto-Expand | On / Off | Off | Auto-open analysis panel |
| Animation | On / Off | On | Enable UI animations |

### Overlay Behavior

| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| Show FAB | On / Off | On | Display floating button |
| FAB Size | Small / Medium / Large | Medium | Button size |
| Panel Width | Compact / Normal / Wide | Normal | Analysis panel width |
| Collapse on Navigate | On / Off | On | Close panel on page change |

## Risk Settings

### Risk Display

| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| Show Risk Badge | On / Off | On | Display risk indicator |
| Risk Colors | Standard / Colorblind | Standard | Color scheme |
| Show Score | On / Off | On | Display numeric score |

### Risk Thresholds

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Low Risk Max | 0-100 | 30 | Maximum score for "low" |
| Medium Risk Max | 0-100 | 70 | Maximum score for "medium" |
| Highlight Threshold | Low / Medium / High | Medium | Minimum risk to highlight |

## Signal Settings

### Signal Types

```
☑️ Whale Alerts
   └─ Minimum Value: [$50,000 ▼]
   
☑️ Liquidity Alerts
   └─ Minimum Change: [5% ▼]
   
☑️ Volume Alerts
   └─ Spike Threshold: [3x ▼]
   
☑️ Price Alerts
   └─ Minimum Change: [20% ▼]
   
☑️ Risk Alerts
   └─ Always enabled for critical risks
```

### Notification Settings

| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| Badge Count | On / Off | On | Show signal count on FAB |
| Sound Alerts | On / Off | Off | Play sound for alerts |
| Desktop Notifications | On / Off | Off | Browser notifications |
| Critical Only | On / Off | Off | Only notify for critical |

## Data Settings

### Caching

| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| Enable Cache | On / Off | On | Cache API responses |
| Cache Duration | 30s / 1m / 5m / 10m | 1m | How long to cache |
| Clear on Close | On / Off | Off | Clear cache on browser close |

### Privacy

| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| Analytics | On / Off | On | Send anonymous usage data |
| Error Reporting | On / Off | On | Send crash reports |
| History | On / Off | Off | Save analysis history locally |

## API Settings

### Connection

| Setting | Description |
|---------|-------------|
| API Key | Your ClawFi API key (optional for basic features) |
| Custom Endpoint | For self-hosted or enterprise |

### Rate Limiting

| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| Requests/Second | 1-20 | 10 | Maximum API requests |
| Retry Attempts | 0-5 | 3 | Retries on failure |
| Timeout | 5-60s | 30s | Request timeout |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + C` | Toggle ClawFi panel |
| `Alt + R` | Refresh analysis |
| `Escape` | Close panel |

Configure in `chrome://extensions/shortcuts`

## Import/Export Settings

### Export Settings
1. Go to Settings page
2. Click "Export Settings"
3. Save the JSON file

### Import Settings
1. Go to Settings page
2. Click "Import Settings"
3. Select your JSON file

### Settings Format

```json
{
  "version": "1.0",
  "general": {
    "theme": "auto",
    "position": "bottom-right",
    "autoExpand": false
  },
  "risk": {
    "showBadge": true,
    "lowMax": 30,
    "mediumMax": 70
  },
  "signals": {
    "whale": true,
    "liquidity": true,
    "volume": true,
    "price": true,
    "minWhaleValue": 50000
  },
  "notifications": {
    "badge": true,
    "sound": false,
    "desktop": false
  }
}
```

## Reset Settings

To reset to defaults:
1. Go to Settings page
2. Scroll to bottom
3. Click "Reset to Defaults"
4. Confirm the reset

Or manually:
1. Go to `chrome://extensions`
2. Remove ClawFi
3. Reinstall fresh

## Next Steps

- [Troubleshooting](troubleshooting.md) - Common issues and fixes
- [Supported Sites](supported-sites.md) - All compatible platforms
- [Risk Indicators](risk-indicators.md) - Understanding risk scores
