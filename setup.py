from setuptools import setup, find_packages

setup(
    name="C:/code/smart-resolution-calc-repo",
    version="0.1.1",
    description="Smart Resolution Calculator for ComfyUI - Flexible resolution and latent generation with toggle-based dimension inputs, automatic calculation of missing values, and rgthree-style compact widgets. Primary use case: specify aspect ratio + height to auto-calculate width for precise image generation.",
    author="Dustin",
    author_email="6962246+djdarcy@users.noreply.github.com",
    packages=find_packages(),
    install_requires=[
        # Add your dependencies here
    ],
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
    ],
    python_requires=">=3.6",
)
