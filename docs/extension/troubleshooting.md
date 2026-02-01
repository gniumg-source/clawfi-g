# Troubleshooting

Solutions to common ClawFi extension issues.

## Common Issues

### Extension Not Appearing

**Symptom**: No ClawFi FAB visible on supported sites.

**Solutions**:

1. **Check extension is enabled**
   - Go to `chrome://extensions`
   - Find ClawFi and ensure toggle is ON

2. **Check site is supported**
   - See [Supported Sites](supported-sites.md)
   - Ensure you're on a token page, not homepage

3. **Refresh the page**
   - Press `Ctrl + R` or `Cmd + R`
   - Try hard refresh: `Ctrl + Shift + R`

4. **Clear browser cache**
   - Settings → Privacy → Clear browsing data
   - Select "Cached images and files"

5. **Reinstall extension**
   - Remove from `chrome://extensions`
   - Reinstall from store or reload unpacked

### FAB Appears But No Data

**Symptom**: FAB shows but clicking shows loading or error.

**Solutions**:

1. **Check internet connection**
   - Ensure you're online
   - Try opening other websites

2. **API rate limit**
   - Wait 60 seconds and try again
   - Reduce request frequency in settings

3. **Token not supported**
   - New tokens may not have data yet
   - Try again in a few minutes

4. **Clear extension cache**
   - Click FAB → Settings icon
   - Clear Cache button

### Wrong Token Displayed

**Symptom**: Analysis shows different token than the page.

**Solutions**:

1. **Check URL format**
   - Ensure URL contains valid token address
   - Some sites use pair address vs token address

2. **Refresh the page**
   - Token detection happens on page load

3. **Report the issue**
   - Note the URL
   - Open GitHub issue with details

### Extension Crashes

**Symptom**: Extension stops working or disappears.

**Solutions**:

1. **Check browser console**
   - Press `F12` → Console tab
   - Look for ClawFi errors

2. **Disable other extensions**
   - Conflicts with other extensions possible
   - Try disabling ad blockers temporarily

3. **Update browser**
   - Ensure Chrome/Brave is up to date

4. **Reinstall extension**
   - Complete removal and fresh install

### High Memory Usage

**Symptom**: Browser using excessive memory with ClawFi.

**Solutions**:

1. **Reduce cache size**
   - Settings → Data → Cache Duration: 30s

2. **Disable history**
   - Settings → Privacy → History: Off

3. **Close unused tabs**
   - ClawFi activates on each supported tab

4. **Restart browser**
   - Full close and reopen

## Error Messages

### "Unable to connect to API"

```
Cause: Network issue or API down
Fix: Check internet, wait and retry
```

### "Token not found"

```
Cause: Token not indexed or invalid address
Fix: Verify address, try again later
```

### "Rate limit exceeded"

```
Cause: Too many requests
Fix: Wait 60 seconds, reduce usage
```

### "Analysis failed"

```
Cause: Backend processing error
Fix: Refresh page, try different token
```

### "Extension context invalidated"

```
Cause: Extension was updated or reloaded
Fix: Refresh all open tabs
```

## Debug Mode

Enable detailed logging for troubleshooting:

1. Go to ClawFi settings
2. Enable "Debug Mode"
3. Open browser console (`F12`)
4. Reproduce the issue
5. Copy console output

### Debug Commands

In browser console:
```javascript
// Check ClawFi state
__CLAWFI_DEBUG__

// Force refresh analysis
__CLAWFI_REFRESH__

// Clear all cache
__CLAWFI_CLEAR_CACHE__
```

## Reporting Issues

### Information to Include

1. **Browser version**
   - `chrome://version`

2. **Extension version**
   - Visible in popup header

3. **Steps to reproduce**
   - Exact URL
   - What you clicked
   - What you expected

4. **Console errors**
   - Open DevTools (`F12`)
   - Copy relevant errors

5. **Screenshots**
   - What you see vs expected

### Where to Report

- **GitHub Issues**: [github.com/ClawFiAI/clawfi/issues](https://github.com/ClawFiAI/clawfi/issues)
- **Discord**: #support channel
- **Twitter**: @ClawFiAI DMs

## FAQ

### Does ClawFi work on mobile?

No, browser extensions are not supported on mobile browsers. Use the SDK for mobile app integration.

### Why is analysis different from other tools?

Each tool uses different data sources and scoring algorithms. ClawFi combines multiple sources for comprehensive analysis.

### Can I use ClawFi with a VPN?

Yes, but some VPN exit nodes may be rate-limited. Try different servers if you experience issues.

### Does ClawFi work in incognito?

By default, no. To enable:
1. Go to `chrome://extensions`
2. Find ClawFi → Details
3. Enable "Allow in incognito"

### Why does ClawFi need these permissions?

- **activeTab**: Read current page to detect tokens
- **storage**: Save your settings
- **Host permissions**: Inject UI on supported sites

### Is my data safe?

Yes. ClawFi:
- Doesn't access your wallet
- Doesn't track browsing history
- Only sends token addresses for analysis
- All data stored locally

## Still Need Help?

If these solutions don't resolve your issue:

1. Check [GitHub Issues](https://github.com/ClawFiAI/clawfi/issues) for similar problems
2. Join our [Discord](https://discord.gg/clawfi) for live support
3. Create a new issue with full debug information
