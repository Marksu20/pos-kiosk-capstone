exports.checkRole = (allowedRoles) => {
    return (req, res, next) => {
        try {
            if(!allowedRoles.includes(req.user.role)) {
                return res.status(401).render('errors/roleDenied');
            }

            next();
        } catch(error) {
            console.error('Error in role check middleware:', error);
            return res.status(500).send('Internal server error.');
        }
    };
};