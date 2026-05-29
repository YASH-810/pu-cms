async function check() {
  try {
    const res = await fetch('http://127.0.0.1:3000/api/v1/admin/blogs?status=archived', {
      headers: { 
        'Authorization': 'Bearer ' + process.env.TOKEN 
      }
    });
    // Wait, I can't easily get a valid JWT token.
    console.log('We need a token to test the API directly.');
  } catch (err) {
    console.error(err);
  }
}
check();
