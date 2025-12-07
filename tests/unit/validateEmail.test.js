const validateEmail = require('../../middlewares/validateEmail');

describe('Middleware: validateEmail', () => {
    let mockRequest;
    let mockResponse;
    let nextFunction;

    beforeEach(() => {
        mockRequest = {
            body: {}
        };
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            render: jest.fn()
        };
        nextFunction = jest.fn();
    });

    it('should call next() if email is valid', () => {
        mockRequest.body.email = 'test@example.com';
        validateEmail(mockRequest, mockResponse, nextFunction);
        expect(nextFunction).toHaveBeenCalled();
        expect(mockResponse.render).not.toHaveBeenCalled();
    });

    it('should return 400 if email is missing', () => {
        mockRequest.body.email = '';
        validateEmail(mockRequest, mockResponse, nextFunction);
        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.render).toHaveBeenCalledWith("forgotPassword", expect.objectContaining({
            error: "Email tidak boleh kosong!"
        }));
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 400 if email format is invalid (no @)', () => {
        mockRequest.body.email = 'invalidemail.com';
        validateEmail(mockRequest, mockResponse, nextFunction);
        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.render).toHaveBeenCalledWith("forgotPassword", expect.objectContaining({
            error: "Format email tidak valid!"
        }));
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 400 if email format is invalid (spaces)', () => {
        mockRequest.body.email = 'test @example.com';
        validateEmail(mockRequest, mockResponse, nextFunction);
        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.render).toHaveBeenCalledWith("forgotPassword", expect.objectContaining({
            error: "Format email tidak valid!"
        }));
    });
});
