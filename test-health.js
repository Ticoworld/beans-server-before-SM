async function testHealthEndpoint() {
  try {
    // Use dynamic import for node-fetch
    const { default: fetch } = await import('node-fetch');
    
    const response = await fetch('http://localhost:5000/health');
    const data = await response.json();
    
    console.log('✅ Health check passed!');
    console.log('Response:', data);
    
    if (data.status === 'alive') {
      console.log('🟢 Bot is running properly');
    } else {
      console.log('🔴 Bot status unknown');
    }
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    console.log('Make sure your server is running with: npm run dev');
  }
}

testHealthEndpoint();
