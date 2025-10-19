export function getAuthSuccessPage(): string {
	return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Authentication Successful - Google Calendar MCP</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%);
            color: #ffffff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          
          .container {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 48px 32px;
            text-align: center;
            max-width: 480px;
            width: 100%;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          }
          
          .icon {
            width: 64px;
            height: 64px;
            margin: 0 auto 24px;
            background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            color: white;
            box-shadow: 0 4px 16px rgba(255, 107, 53, 0.3);
          }
          
          h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 12px;
            background: linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          
          p {
            font-size: 16px;
            color: #b0b0b0;
            line-height: 1.6;
            margin-bottom: 32px;
          }
          
          .status {
            display: inline-flex;
            align-items: center;
            background: rgba(34, 197, 94, 0.1);
            border: 1px solid rgba(34, 197, 94, 0.2);
            border-radius: 8px;
            padding: 8px 16px;
            font-size: 14px;
            font-weight: 500;
            color: #22c55e;
            margin-bottom: 24px;
          }
          
          .status::before {
            content: 'OK';
            margin-right: 8px;
            font-weight: bold;
          }
          
          .close-hint {
            font-size: 14px;
            color: #808080;
            font-style: italic;
          }
          
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          .container {
            animation: fadeIn 0.6s ease-out;
          }
          
          .icon {
            animation: fadeIn 0.8s ease-out 0.2s both;
          }
          
          h1 {
            animation: fadeIn 0.8s ease-out 0.4s both;
          }
          
          p, .status {
            animation: fadeIn 0.8s ease-out 0.6s both;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">SUCCESS</div>
          <h1>Authentication Successful!</h1>
          <div class="status">Connected to Google Calendar</div>
          <p>Your Google Calendar MCP server is now authenticated and ready to use. You can close this window and return to your application.</p>
          <p class="close-hint">This window will close automatically...</p>
        </div>
        <script>
          // Auto-close after 3 seconds
          setTimeout(() => {
            window.close();
          }, 3000);
        </script>
      </body>
      </html>
    `
}

export function getAuthErrorPage(error: string): string {
	return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>OAuth Error - Google Calendar MCP</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%);
            color: #ffffff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          
          .container {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(239, 68, 68, 0.2);
            border-radius: 16px;
            padding: 48px 32px;
            text-align: center;
            max-width: 480px;
            width: 100%;
            box-shadow: 0 8px 32px rgba(239, 68, 68, 0.1);
          }
          
          .icon {
            width: 64px;
            height: 64px;
            margin: 0 auto 24px;
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            color: white;
            box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
          }
          
          h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 12px;
            color: #ffffff;
          }
          
          p {
            font-size: 16px;
            color: #b0b0b0;
            line-height: 1.6;
            margin-bottom: 16px;
          }
          
          .error-detail {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.2);
            border-radius: 8px;
            padding: 12px 16px;
            font-size: 14px;
            color: #ef4444;
            margin: 16px 0;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
          }
          
          .retry-hint {
            font-size: 14px;
            color: #808080;
            font-style: italic;
          }
          
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          .container {
            animation: fadeIn 0.6s ease-out;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">LOCK</div>
          <h1>OAuth Error</h1>
          <p>There was an issue with the OAuth authentication process.</p>
          <div class="error-detail">Error: ${error}</div>
          <p class="retry-hint">Please try the authentication process again.</p>
        </div>
      </body>
      </html>
    `
}

export function getAuthFailedPage(): string {
	return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Authentication Failed - Google Calendar MCP</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%);
            color: #ffffff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          
          .container {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(239, 68, 68, 0.2);
            border-radius: 16px;
            padding: 48px 32px;
            text-align: center;
            max-width: 480px;
            width: 100%;
            box-shadow: 0 8px 32px rgba(239, 68, 68, 0.1);
          }
          
          .icon {
            width: 64px;
            height: 64px;
            margin: 0 auto 24px;
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            color: white;
            box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
          }
          
          h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 12px;
            color: #ffffff;
          }
          
          p {
            font-size: 16px;
            color: #b0b0b0;
            line-height: 1.6;
            margin-bottom: 16px;
          }
          
          .status {
            display: inline-flex;
            align-items: center;
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.2);
            border-radius: 8px;
            padding: 8px 16px;
            font-size: 14px;
            font-weight: 500;
            color: #ef4444;
            margin-bottom: 24px;
          }
          
          .status::before {
            content: 'X';
            margin-right: 8px;
            font-weight: bold;
          }
          
          .retry-hint {
            font-size: 14px;
            color: #808080;
            font-style: italic;
          }
          
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          .container {
            animation: fadeIn 0.6s ease-out;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">WARNING</div>
          <h1>Authentication Failed</h1>
          <div class="status">Invalid authorization</div>
          <p>There was an issue with the authentication process. This may be due to an invalid state or missing authorization code.</p>
          <p class="retry-hint">Please try the authentication process again.</p>
        </div>
      </body>
      </html>
    `
}
