from django.shortcuts import render


def base(request):
    return render(request, 'store/base.html')


def home(request):
    return render(request, 'store/home.html')


def about(request):
    return render(request, 'store/about.html')


def cart(request):
    return render(request, 'store/cart.html')


def shop(request):
    return render(request, 'store/shop.html')
