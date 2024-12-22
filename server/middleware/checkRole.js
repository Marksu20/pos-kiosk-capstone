exports.checkRole = (requiredRoles) => {
    return (req, res, next) => {
        if(requiredRoles.includes(req.user.role)) {
            next();
        } else {
            res.status(403).send('Access Denied');        }
    }
}