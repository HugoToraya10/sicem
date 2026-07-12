import { Link, useLocation } from 'react-router-dom'
import './Navbar.css'

const Navbar = ({ userName, roleLabel, links }) => {
    const location = useLocation()

    return (
        <nav className="navbar">
            <span className="navbar-logo">SICEM</span>
            <div className="navbar-links">
                {links.map((link) => (
                    <Link
                        key={link.to}
                        to={link.to}
                        className={location.pathname === link.to ? 'active' : ''}
                    >
                        {link.label}
                    </Link>
                ))}
            </div>
            <span className="navbar-user">
                <span className="navbar-user-dot" />
                {userName} — {roleLabel}
            </span>
        </nav>
    )
}

export default Navbar