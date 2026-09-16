from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.api.auth import get_current_user, get_db, security
from app.models.user import User


# =========================
# Get Authenticated User
# =========================

def get_authenticated_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Validate the JWT and return the authenticated user.
    """

    return get_current_user(
        credentials=credentials,
        db=db
    )


# =========================
# Admin Authorization
# =========================

def require_admin(
    current_user: User = Depends(get_authenticated_user)
) -> User:
    """
    Allow access only to ADMIN users.
    """

    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return current_user


# =========================
# Employee Authorization
# =========================

def require_employee(
    current_user: User = Depends(get_authenticated_user)
) -> User:
    """
    Allow access only to EMPLOYEE users.
    """

    if current_user.role != "employee":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee access required"
        )

    return current_user


# =========================
# Support Access
# =========================

def require_support_access(
    current_user: User = Depends(get_authenticated_user)
) -> User:
    """
    Allow access to ADMIN and EMPLOYEE users.
    Customers are not allowed.
    """

    if current_user.role not in {"admin", "employee"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Support employee or admin access required"
        )

    return current_user


# =========================
# Customer Authorization
# =========================

def require_customer(
    current_user: User = Depends(get_authenticated_user)
) -> User:
    """
    Allow access only to CUSTOMER users.
    """

    if current_user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer access required"
        )

    return current_user