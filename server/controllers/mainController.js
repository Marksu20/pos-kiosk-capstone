// GET: homepage
exports.signin = async (req, res) => {
  const locals = {
    title: "koka POS",
    description: "koka POS web application"
  }

  res.render('index', locals);
}

// GET: sigin
exports.signup = async (req, res) => {
  const locals = {
    title: "koka POS",
    description: "koka POS web application"
  }

  res.render('signup', locals);
}