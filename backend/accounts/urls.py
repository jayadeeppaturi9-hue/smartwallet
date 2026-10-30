from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import CustomLoginView, RegisterView, UserProfileView, LogoutView

urlpatterns = [
    path('login/', CustomLoginView.as_view(), name='auth_login'),
    path('token/', CustomLoginView.as_view(), name='auth_token'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('register/', RegisterView.as_view(), name='auth_register'),
    path('me/', UserProfileView.as_view(), name='auth_me'),
    path('user/', UserProfileView.as_view(), name='auth_user'),
    path('logout/', LogoutView.as_view(), name='auth_logout'),
]
