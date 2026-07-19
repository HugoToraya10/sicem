import { Link, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import './Navbar.css'

const Navbar = ({ userName, roleLabel, links }) => {
    const location = useLocation()
    const [openDropdown, setOpenDropdown] = useState(null)
    const dropdownRef = useRef(null)

    // Cierra el dropdown si el usuario hace clic fuera de él
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setOpenDropdown(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Un link "normal" tiene `to`. Un dropdown tiene `children` en su lugar.
    const isDropdownItem = (link) => Boolean(link.children)

    // El dropdown se marca como activo si la ruta actual coincide con alguno de sus hijos
    const isDropdownActive = (link) =>
        link.children.some((child) => location.pathname === child.to)

    return (
        <nav className="navbar">
            <span className="navbar-logo">SICEM</span>
            <div className="navbar-links" ref={dropdownRef}>
                {links.map((link) => {
                    if (isDropdownItem(link)) {
                        const isOpen = openDropdown === link.label
                        return (
                            <div className="navbar-dropdown" key={link.label}>
                                <button
                                    className={`navbar-dropdown-trigger ${isDropdownActive(link) ? 'active' : ''}`}
                                    onClick={() => setOpenDropdown(isOpen ? null : link.label)}
                                >
                                    {link.label}
                                    <span className={`navbar-dropdown-arrow ${isOpen ? 'open' : ''}`}>▾</span>
                                </button>
                                {isOpen && (
                                    <div className="navbar-dropdown-menu">
                                        {link.children.map((child) => (
                                            <Link
                                                key={child.to}
                                                to={child.to}
                                                className={location.pathname === child.to ? 'active' : ''}
                                                onClick={() => setOpenDropdown(null)}
                                            >
                                                {child.label}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    }

                    return (
                        <Link
                            key={link.to}
                            to={link.to}
                            className={location.pathname === link.to ? 'active' : ''}
                        >
                            {link.label}
                        </Link>
                    )
                })}
            </div>
            <span className="navbar-user">
                <span className="navbar-user-dot" />
                {userName} — {roleLabel}
            </span>
        </nav>
    )
}

export default Navbar