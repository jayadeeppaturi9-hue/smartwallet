from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth.models import User
from .serializers import UserSerializer, RegisterSerializer, CustomTokenObtainPairSerializer


class CustomLoginView(TokenObtainPairView):
    """
    POST /api/auth/login/
    JWT Login view returning access, refresh, token, and user profile.
    """
    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(generics.CreateAPIView):
    """
    POST /api/auth/register/
    Register a new user account.
    """
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = (permissions.AllowAny,)


class UserProfileView(APIView):
    """
    GET /api/auth/me/ or /api/auth/user/
    Retrieve current authenticated user.
    """
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Logout and invalidate active credentials.
    """
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        return Response({'success': True, 'message': 'Successfully logged out.'}, status=status.HTTP_200_OK)
